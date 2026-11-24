// What the account shows of her purchases and favourites (CU-07, CU-12 to
// CU-15, PDP-09). Database only, so it is tested without a request.
import type { Order, PrismaClient, Prisma, Shipment } from '@prisma/client'
import { addToCart } from '@/server/commerce/cart'
import { normalizeOrderNumber, WITHDRAWAL_DAYS } from '@/server/commerce/aftersale'
import { loadCatalog } from '@/server/services/catalog/catalog'
import { publishedProductWhere } from '@/server/services/catalog/rules'
import type { SettingValues } from '@/server/settings'

type Db = PrismaClient | Prisma.TransactionClient

const DAY_MS = 24 * 60 * 60 * 1000

export async function customerOrders(db: PrismaClient, customerId: string) {
  return db.order.findMany({
    where: { customerId },
    orderBy: { placedAt: 'desc' },
    take: 100,
    include: { items: { include: { reviews: { select: { id: true } }, variant: { select: { product: { select: { routineStep: true } } } } } }, shipment: true },
  })
}

export async function lastOrder(db: PrismaClient, customerId: string) {
  return db.order.findFirst({ where: { customerId }, orderBy: { placedAt: 'desc' }, select: { id: true, number: true, status: true, placedAt: true } })
}

/** CU-14: "Tenés 10 días corridos desde que la recibís." Only on a delivered order, while the window is open. */
export function withdrawalOpen(order: Pick<Order, 'status' | 'deliveredAt'>, now = new Date()): boolean {
  if (!order.deliveredAt || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status)) return false
  return now.getTime() - order.deliveredAt.getTime() < WITHDRAWAL_DAYS * DAY_MS
}

/** "Seguir envío": the carrier's page when there is one; with only a code, the order page that shows it. */
export function trackingTarget(shipment: Pick<Shipment, 'trackingUrl' | 'trackingCode'> | null): 'url' | 'order' | null {
  if (!shipment) return null
  if (shipment.trackingUrl && /^https?:\/\//i.test(shipment.trackingUrl)) return 'url'
  return shipment.trackingCode ? 'order' : null
}

/** Whether a delivered order still has a line she can review (F-22, from her account). */
export function hasReviewableLine(order: Pick<Order, 'status' | 'deliveredAt'> & { items: { productId: string | null; quantity: number; refundedQuantity: number; reviews: { id: string }[] }[] }): boolean {
  if (!order.deliveredAt || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status)) return false
  return order.items.some((i) => i.productId && i.refundedQuantity < i.quantity && !i.reviews.length)
}

/**
 * "Volver a comprar" (CU-12): the same SKUs and quantities into her cart, at
 * today's price. What is no longer sold or has no stock is skipped and named.
 */
export async function reorder(db: Db, customerId: string, orderNumber: string, cartId: string): Promise<{ ok: true; added: number; skipped: string[] } | { ok: false }> {
  const number = normalizeOrderNumber(orderNumber)
  const order = number ? await db.order.findFirst({ where: { number, customerId }, include: { items: true } }) : null
  if (!order) return { ok: false }
  let added = 0
  const skipped: string[] = []
  for (const item of order.items) {
    const quantity = item.quantity - item.refundedQuantity
    if (quantity <= 0) continue
    const r = await addToCart(db, cartId, { sku: item.sku, quantity, source: 'OTHER', sourceRef: `reorder:${order.number}` })
    if (r) added++
    else skipped.push(item.productName)
  }
  return { ok: true, added, skipped }
}

// ------------------------------------------------------------ favourites ----

/** PDP-09: saves (never removes) a published product; used on return from signing in. */
export async function saveFavorite(db: PrismaClient, customerId: string, productCode: string): Promise<boolean> {
  const product = await db.product.findFirst({ where: { code: productCode, ...publishedProductWhere() }, select: { id: true } })
  if (!product) return false
  await db.favorite.upsert({ where: { customerId_productId: { customerId, productId: product.id } }, create: { customerId, productId: product.id }, update: {} })
  return true
}

export async function isFavorite(db: PrismaClient, customerId: string, productId: string): Promise<boolean> {
  return !!(await db.favorite.findUnique({ where: { customerId_productId: { customerId, productId } }, select: { productId: true } }))
}

/** CU-15: her favourites that are still published, the latest first. */
export async function favoriteItems(db: PrismaClient, customerId: string, settings: SettingValues) {
  const favs = await db.favorite.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, select: { productId: true } })
  if (!favs.length) return []
  const items = await loadCatalog(db, settings, { ...publishedProductWhere(), id: { in: favs.map((f) => f.productId) } })
  const order = new Map(favs.map((f, i) => [f.productId, i]))
  return items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}
