// The cart lives in the browser (Phase 2 moves it to the server with
// checkout), so prices are never taken from it: the cart page re-reads every
// SKU here, and only published products come back.
import type { PrismaClient, RoutineStepType } from '@prisma/client'
import { resolveImages } from '@/server/media'
import { MOMENT_LABELS, STEP_LABELS } from './labels'
import { chargedCents, presaleLabel, publishedProductWhere, sizeLabel, variantAvailable } from './rules'

export const MAX_CART_SKUS = 50
/** Per line, until checkout sets real limits. */
export const MAX_LINE_QTY = 10

export type CartItem = {
  sku: string
  productCode: string
  name: string
  brand: string
  sizeLabel: string
  routineStep: RoutineStepType
  stepLabel: string
  momentLabel: string
  priceCents: number
  promoPriceCents: number | null
  chargedCents: number
  available: boolean
  /** How many of this size can go in the cart (stock, capped). */
  maxQty: number
  presale: string | null
  image: { src: string; width: number; height: number; alt: string } | null
}

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function cleanSkus(input: string[]): string[] {
  return [...new Set(input.map((s) => s.trim()).filter((s) => SKU.test(s)))].slice(0, MAX_CART_SKUS)
}

export async function getCartItems(db: PrismaClient, skus: string[]): Promise<CartItem[]> {
  const wanted = cleanSkus(skus)
  if (!wanted.length) return []
  const variants = await db.productVariant.findMany({
    where: { sku: { in: wanted }, product: publishedProductWhere() },
    include: { product: { select: { code: true, name: true, status: true, presaleDate: true, images: true, routineStep: true, moment: true, brand: { select: { name: true } } } } },
  })
  const images = await resolveImages(db, variants.map((v) => v.product.images[0] ?? '').filter(Boolean))
  const now = new Date()
  return variants.map((v) => {
    const p = v.product
    const available = variantAvailable(p.status, v.stock)
    const img = p.images[0] ? images.get(p.images[0]) : undefined
    return {
      sku: v.sku,
      productCode: p.code,
      name: p.name,
      brand: p.brand.name,
      sizeLabel: sizeLabel(Number(v.size), v.unit),
      routineStep: p.routineStep,
      stepLabel: STEP_LABELS[p.routineStep],
      momentLabel: MOMENT_LABELS[p.moment],
      priceCents: v.priceCents,
      promoPriceCents: v.promoPriceCents,
      chargedCents: chargedCents(v),
      available,
      maxQty: !available ? 0 : p.status === 'PRESALE' ? MAX_LINE_QTY : Math.min(MAX_LINE_QTY, v.stock),
      presale: p.status === 'PRESALE' ? presaleLabel(p.presaleDate, now) : null,
      image: img ? { src: img.src, width: img.width, height: img.height, alt: img.alt || `${p.name}, de ${p.brand.name}` } : null,
    }
  })
}
