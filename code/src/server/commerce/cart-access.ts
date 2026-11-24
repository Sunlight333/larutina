// Which server cart a browser is using, and what the storefront shows of it
// (CMP-01). Database only, so it is tested without a request; the cookie side
// is in ./cart-cookie.ts.
//
//   - A guest's cart is found by the cookie token.
//   - A signed-in customer uses her open cart. A guest cart in this browser
//     joins it (mergeCarts), so nothing added before logging in is lost.
//   - When the cart in use is not the one the cookie names (merged, or her
//     cart from another device), it gets a new token for this browser.
import type { ItemSource, PrismaClient } from '@prisma/client'
import type { SettingValues } from '@/server/settings'
import { addToCart, findCartById, hashCartToken, mergeCarts, newCartToken, viewCart, MAX_LINES, type CartView } from './cart'
import { publicCart, type PublicCart } from './public'
import { optionKey, quoteShipping, type QuoteOption } from './shipping/quote'

export type LocatedCart = { cartId: string | null; newToken: string | null }

export async function locateCart(
  db: PrismaClient,
  token: string | null | undefined,
  customerId: string | null,
  opts: { create: boolean; retoken: boolean },
): Promise<LocatedCart> {
  const own = token ? await db.cart.findUnique({ where: { token: hashCartToken(token) }, select: { id: true, customerId: true, convertedAt: true } }) : null
  const open = own && !own.convertedAt ? own : null
  const retoken = async (cartId: string): Promise<LocatedCart> => {
    if (!opts.retoken) return { cartId, newToken: null }
    const fresh = newCartToken()
    await db.cart.update({ where: { id: cartId }, data: { token: hashCartToken(fresh) } })
    return { cartId, newToken: fresh }
  }
  const create = async (): Promise<LocatedCart> => {
    if (!opts.create) return { cartId: null, newToken: null }
    const fresh = newCartToken()
    const cart = await db.cart.create({ data: { token: hashCartToken(fresh), customerId } })
    return { cartId: cart.id, newToken: fresh }
  }

  if (customerId) {
    if (open?.customerId === customerId) return { cartId: open.id, newToken: null }
    if (open && !open.customerId) {
      const merged = await mergeCarts(db, open.id, customerId)
      return merged === open.id ? { cartId: merged, newToken: null } : retoken(merged)
    }
    const hers = await db.cart.findFirst({ where: { customerId, convertedAt: null }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
    if (hers) return retoken(hers.id)
    return create()
  }
  if (open) return { cartId: open.id, newToken: null }
  return create()
}

/** The cart as the storefront shows it: the public shape plus the "Con transferencia" total (BO-09). */
export type ShopCart = PublicCart & {
  /** Goods total paying by transfer; null when transfer is not offered or its discount is 0. */
  transferTotalCents: number | null
}

export type CartRow = Awaited<ReturnType<typeof findCartById>>

export async function shopCart(db: PrismaClient, row: CartRow, s: SettingValues, opts: { transferAvailable: boolean; fix?: boolean }): Promise<{ view: CartView; cart: ShopCart }> {
  const capPct = s['commerce.discountCapPct']
  const view = await viewCart(db, row, { capPct, fix: opts.fix })
  let transferTotalCents: number | null = null
  const pct = s['commerce.transferDiscountPct']
  if (opts.transferAvailable && pct > 0 && view.lines.length) {
    transferTotalCents = (await viewCart(db, row, { capPct, transferPct: pct })).pricing.totalCents
  }
  return { view, cart: { ...publicCart(view), transferTotalCents } }
}

// --------------------------------------------------------- legacy import ----

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/**
 * The Phase 1 cart lived in localStorage (SKU and quantity only). The first
 * visit after the switch sends it here once. A SKU already in the server cart
 * is left as it is, so sending the same list twice changes nothing.
 */
export async function importLegacyLines(db: PrismaClient, cartId: string, lines: unknown): Promise<number> {
  if (!Array.isArray(lines)) return 0
  const existing = new Set((await db.cartItem.findMany({ where: { cartId }, select: { variant: { select: { sku: true } } } })).map((i) => i.variant.sku))
  let added = 0
  for (const raw of lines.slice(0, MAX_LINES)) {
    const l = raw as { sku?: unknown; qty?: unknown }
    if (typeof l?.sku !== 'string' || !SKU.test(l.sku) || existing.has(l.sku)) continue
    const qty = Number.isInteger(l.qty) && (l.qty as number) > 0 ? (l.qty as number) : 1
    if (await addToCart(db, cartId, { sku: l.sku, quantity: qty, source: 'OTHER', sourceRef: 'carrito-anterior' })) {
      existing.add(l.sku)
      added++
    }
  }
  return added
}

// ------------------------------------------------------------ add input ----

const SOURCES: readonly ItemSource[] = ['PDP', 'LISTING', 'ROUTINE', 'DIAGNOSIS', 'WHATSAPP', 'AMBASSADOR', 'SEARCH', 'OTHER']

/** What the browser may say about an added item: a known source and a short reference. */
export function cleanAddInput(body: unknown): { sku: string; quantity: number; source: ItemSource; sourceRef: string | null } | null {
  const b = body as { sku?: unknown; quantity?: unknown; source?: unknown; sourceRef?: unknown } | null
  if (typeof b?.sku !== 'string' || !SKU.test(b.sku)) return null
  const quantity = Number.isInteger(b.quantity) && (b.quantity as number) > 0 ? Math.min(b.quantity as number, 10) : 1
  const source = SOURCES.includes(b.source as ItemSource) ? (b.source as ItemSource) : 'OTHER'
  const sourceRef = typeof b.sourceRef === 'string' && b.sourceRef.trim() ? b.sourceRef.trim().slice(0, 200) : null
  return { sku: b.sku, quantity, source, sourceRef }
}

// ------------------------------------------------------------- recovery ----

/**
 * The abandoned-cart email's link (EML-04): signed with the cart id. The cart
 * gets a new token, which the route sets as this browser's cookie. Returns
 * null when the link is not valid or the cart was already bought.
 */
export async function recoverCart(db: PrismaClient, cartId: string, valid: boolean): Promise<string | null> {
  if (!valid) return null
  const cart = await db.cart.findUnique({ where: { id: cartId }, select: { id: true, convertedAt: true } })
  if (!cart || cart.convertedAt) return null
  const fresh = newCartToken()
  await db.cart.update({ where: { id: cart.id }, data: { token: hashCartToken(fresh) } })
  return fresh
}

// ------------------------------------------------------------- shipping ----

/** A shipping option as the browser sees it: no provider reference, box or weight. */
export type PublicShippingOption = { key: string; carrier: string; service: string; minDays: number; maxDays: number; priceCents: number; originalPriceCents: number; free: boolean }

export type PublicQuote = { ok: true; options: PublicShippingOption[] } | { ok: false; error: 'postcode' | 'no-rates' | 'empty' }

export function publicOption(o: QuoteOption): PublicShippingOption {
  return { key: optionKey(o), carrier: o.carrier, service: o.service, minDays: o.minDays, maxDays: o.maxDays, priceCents: o.priceCents, originalPriceCents: o.originalPriceCents, free: o.free }
}

/** BO-08 and CK-06: the options for this cart, cheapest first, up to the configured number. The postcode is kept on the cart. */
export async function quoteCart(db: PrismaClient, view: CartView, s: SettingValues, input: { postcode: string; province?: string | null }): Promise<PublicQuote> {
  if (!view.id || !view.lines.length) return { ok: false, error: 'empty' }
  const q = await quoteShipping(db, {
    postcode: input.postcode,
    province: input.province || null,
    parcels: view.lines.map((l) => l.parcel),
    goodsCents: view.pricing.totalCents,
    freeFromCents: s['commerce.freeShippingFromCents'],
    maxOptions: s['commerce.shippingOptions'],
  })
  if (!q.ok) return q
  const postcode = input.postcode.trim().toUpperCase().slice(0, 12)
  if (postcode !== view.postcode) await db.cart.update({ where: { id: view.id }, data: { postcode } }).catch(() => {})
  return { ok: true, options: q.options.map(publicOption) }
}
