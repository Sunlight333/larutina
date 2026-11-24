// The cart on the server (CMP-01): one per browser, found by a cookie token,
// kept between visits, and joined to the account at login. Prices are always
// read from the catalog and priced by the cascade (lib/commerce/pricing),
// never stored in the cart. Lines that ran out or are short are fixed on read,
// with the content file's notices (BO-11).
import { createHash, randomBytes } from 'node:crypto'
import type { ItemSource, Prisma, PrismaClient } from '@prisma/client'
import { priceCart, type Pricing } from '@/lib/commerce/pricing'
import type { Parcel } from '@/lib/commerce/boxes'
import { resolveImages } from '@/server/media'
import { MOMENT_LABELS, STEP_LABELS } from '@/server/services/catalog/labels'
import { chargedCents, presaleLabel, publishedProductWhere, sizeLabel, variantAvailable } from '@/server/services/catalog/rules'
import { checkCoupon } from './coupons'
import { cartRoutines, type CartRoutine } from './routines'

type Db = PrismaClient | Prisma.TransactionClient

export const CART_COOKIE = 'lr_cart'
export const MAX_LINE_QTY = 10
export const MAX_LINES = 50

export const hashCartToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newCartToken = () => randomBytes(24).toString('base64url')

export type CartLineView = {
  id: string
  variantId: string
  sku: string
  productId: string
  productCode: string
  name: string
  brand: string
  sizeLabel: string
  stepLabel: string
  momentLabel: string
  unitPriceCents: number
  unitChargedCents: number
  quantity: number
  maxQty: number
  presale: string | null
  isKit: boolean
  source: ItemSource
  sourceRef: string | null
  routineGroup: string | null
  image: { src: string; width: number; height: number; alt: string } | null
  imageFile: string | null
  unitCostCents: number | null
  parcel: Parcel
}

export type CartView = {
  id: string | null
  email: string | null
  couponCode: string | null
  couponError: string | null
  postcode: string | null
  lines: CartLineView[]
  /** BO-11 notices produced while reading the cart. */
  notices: string[]
  pricing: Pricing
  /** Routines in the cart and whether each is complete (BO-03, RUT-03). */
  routines: CartRoutine[]
  count: number
}

const EMPTY_PRICING = priceCart({ lines: [] })

export function emptyCartView(): CartView {
  return { id: null, email: null, couponCode: null, couponError: null, postcode: null, lines: [], notices: [], pricing: EMPTY_PRICING, routines: [], count: 0 }
}

const cartInclude = {
  items: {
    orderBy: { addedAt: 'asc' },
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, code: true, name: true, status: true, type: true, presaleDate: true, images: true, routineStep: true, moment: true, deletedAt: true, brand: { select: { name: true, deletedAt: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude

type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>

export async function findCart(db: Db, token: string | undefined | null) {
  if (!token) return null
  return db.cart.findUnique({ where: { token: hashCartToken(token) }, include: cartInclude })
}

export async function findCustomerCart(db: Db, customerId: string) {
  return db.cart.findFirst({ where: { customerId, convertedAt: null }, orderBy: { updatedAt: 'desc' }, include: cartInclude })
}

/**
 * Reads a cart for display or checkout: drops lines that can no longer be
 * bought, trims quantities to the stock, and prices the rest. With `fix`, the
 * corrections are written back so the notices show once.
 */
export async function viewCart(db: Db, cart: CartRow | null, opts: { transferPct?: number; capPct?: number; fix?: boolean; email?: string | null; dni?: string | null } = {}): Promise<CartView> {
  if (!cart) return emptyCartView()
  const now = new Date()
  const notices: string[] = []
  const keep: CartRow['items'] = []
  for (const item of cart.items) {
    const v = item.variant
    const p = v.product
    const published = !p.deletedAt && !p.brand.deletedAt && ['ACTIVE', 'PRESALE', 'SOLD_OUT'].includes(p.status)
    const available = published && variantAvailable(p.status, v.stock)
    if (!available) {
      notices.push(`${p.name} se quedó sin stock y lo sacamos de tu carrito.`)
      if (opts.fix) await db.cartItem.delete({ where: { id: item.id } }).catch(() => {})
      continue
    }
    const max = p.status === 'PRESALE' ? MAX_LINE_QTY : Math.min(MAX_LINE_QTY, v.stock)
    if (item.quantity > max) {
      notices.push(`Quedan ${max} ${max === 1 ? 'unidad' : 'unidades'} de ${p.name}.`)
      if (opts.fix) await db.cartItem.update({ where: { id: item.id }, data: { quantity: max } }).catch(() => {})
      item.quantity = max
    }
    keep.push(item)
  }

  const files = keep.map((i) => i.variant.product.images[0] ?? '').filter(Boolean)
  const images = files.length ? await resolveImages(db as PrismaClient, files) : new Map()
  const lines: CartLineView[] = keep.map((i) => {
    const v = i.variant
    const p = v.product
    const file = p.images[0] ?? null
    const img = file ? images.get(file) : undefined
    return {
      id: i.id,
      variantId: v.id,
      sku: v.sku,
      productId: p.id,
      productCode: p.code,
      name: p.name,
      brand: p.brand.name,
      sizeLabel: sizeLabel(Number(v.size), v.unit),
      stepLabel: STEP_LABELS[p.routineStep],
      momentLabel: MOMENT_LABELS[p.moment],
      unitPriceCents: v.priceCents,
      unitChargedCents: chargedCents(v),
      quantity: i.quantity,
      maxQty: p.status === 'PRESALE' ? MAX_LINE_QTY : Math.min(MAX_LINE_QTY, v.stock),
      presale: p.status === 'PRESALE' ? presaleLabel(p.presaleDate, now) : null,
      isKit: p.type === 'KIT',
      source: i.source,
      sourceRef: i.sourceRef,
      routineGroup: i.routineGroup,
      image: img ? { src: img.src, width: img.width, height: img.height, alt: img.alt || `${p.name}, de ${p.brand.name}` } : null,
      imageFile: file,
      unitCostCents: v.costCents,
      parcel: { heightCm: v.heightCm ? Number(v.heightCm) : null, widthCm: v.widthCm ? Number(v.widthCm) : null, lengthCm: v.lengthCm ? Number(v.lengthCm) : null, weightGrams: v.weightGrams, quantity: i.quantity },
    }
  })

  const subtotalCents = lines.reduce((a, l) => a + l.unitChargedCents * l.quantity, 0)
  let couponError: string | null = null
  let code = null
  if (cart.couponCode && lines.length) {
    const check = await checkCoupon(db, cart.couponCode, { subtotalCents, email: opts.email ?? cart.email, dni: opts.dni })
    if (check.ok) code = check.discount
    else couponError = check.error
  }
  // Only the lines of a complete routine (or half, when allowed) earn its discount.
  const routines = await cartRoutines(db, lines)
  const eligible = new Map(routines.flatMap((r) => (r.discountPct > 0 ? r.lineIds.map((id) => [id, r.group] as const) : [])))
  const pricing = priceCart({
    lines: lines.map((l) => ({ key: l.id, unitChargedCents: l.unitChargedCents, quantity: l.quantity, routineGroup: eligible.get(l.id) ?? null })),
    routineGroups: Object.fromEntries(routines.filter((r) => r.discountPct > 0 && r.lineIds.length).map((r) => [r.group, r.discountPct])),
    code,
    transferPct: opts.transferPct ?? 0,
    capPct: opts.capPct ?? 0,
  })
  return {
    id: cart.id,
    email: cart.email,
    couponCode: cart.couponCode,
    couponError,
    postcode: cart.postcode,
    lines,
    notices,
    pricing,
    routines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
  }
}

/** The cart for this cookie, created on first write. Returns the token to set when a new one was made. */
export async function ensureCart(db: Db, token: string | null | undefined, customerId: string | null): Promise<{ cartId: string; newToken: string | null }> {
  if (token) {
    const cart = await db.cart.findUnique({ where: { token: hashCartToken(token) }, select: { id: true, convertedAt: true, customerId: true } })
    if (cart && !cart.convertedAt) {
      if (customerId && !cart.customerId) await db.cart.update({ where: { id: cart.id }, data: { customerId } })
      return { cartId: cart.id, newToken: null }
    }
  }
  const fresh = newCartToken()
  const cart = await db.cart.create({ data: { token: hashCartToken(fresh), customerId } })
  return { cartId: cart.id, newToken: fresh }
}

export type AddInput = { sku: string; quantity: number; source?: ItemSource; sourceRef?: string | null; routineGroup?: string | null }

/** Adds or raises a line. Returns null when the SKU cannot be bought. */
export async function addToCart(db: Db, cartId: string, input: AddInput): Promise<{ quantity: number } | null> {
  const variant = await db.productVariant.findFirst({ where: { sku: input.sku, product: publishedProductWhere() }, include: { product: { select: { status: true } } } })
  if (!variant || !variantAvailable(variant.product.status, variant.stock)) return null
  const max = variant.product.status === 'PRESALE' ? MAX_LINE_QTY : Math.min(MAX_LINE_QTY, variant.stock)
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId: variant.id } } })
  const quantity = Math.max(1, Math.min(max, (existing?.quantity ?? 0) + Math.max(1, Math.floor(input.quantity))))
  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity, ...(input.routineGroup ? { routineGroup: input.routineGroup } : {}) } })
  } else {
    if ((await db.cartItem.count({ where: { cartId } })) >= MAX_LINES) return null
    await db.cartItem.create({ data: { cartId, variantId: variant.id, quantity, source: input.source ?? 'OTHER', sourceRef: input.sourceRef ?? null, routineGroup: input.routineGroup ?? null } })
  }
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } })
  return { quantity }
}

export async function setLineQuantity(db: Db, cartId: string, lineId: string, quantity: number) {
  const q = Math.floor(quantity)
  if (q <= 0) await db.cartItem.deleteMany({ where: { id: lineId, cartId } })
  else await db.cartItem.updateMany({ where: { id: lineId, cartId }, data: { quantity: Math.min(MAX_LINE_QTY, q) } })
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } })
}

export async function setCoupon(db: Db, cartId: string, code: string | null) {
  await db.cart.update({ where: { id: cartId }, data: { couponCode: code } })
}

/** At login: the guest cart's lines move into the account's open cart (quantities add up, capped). */
export async function mergeCarts(db: Db, guestCartId: string, customerId: string) {
  const target = await db.cart.findFirst({ where: { customerId, convertedAt: null, id: { not: guestCartId } }, orderBy: { updatedAt: 'desc' } })
  if (!target) {
    await db.cart.update({ where: { id: guestCartId }, data: { customerId } })
    return guestCartId
  }
  const guest = await db.cart.findUnique({ where: { id: guestCartId }, include: { items: true } })
  if (!guest) return target.id
  for (const item of guest.items) {
    const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } } })
    if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(MAX_LINE_QTY, existing.quantity + item.quantity) } })
    else await db.cartItem.create({ data: { cartId: target.id, variantId: item.variantId, quantity: item.quantity, source: item.source, sourceRef: item.sourceRef, routineGroup: item.routineGroup } })
  }
  await db.cart.update({ where: { id: target.id }, data: { couponCode: target.couponCode ?? guest.couponCode, updatedAt: new Date() } })
  await db.cart.delete({ where: { id: guestCartId } })
  return target.id
}
