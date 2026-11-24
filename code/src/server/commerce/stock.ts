// Stock without oversell (PED-02). Stock is taken when the payment starts and
// given back when an unpaid order expires or is cancelled; a paid order
// commits its reservation. Each take is one conditional UPDATE, so of two
// buyers racing for the last unit exactly one wins, whatever the timing.
// A kit is a product with its own SKU and stock: reserving it never touches
// the stock of what it contains (D-06, CAT-07). Pre-sale products sell with
// no stock (NAV-08): their stock may go below zero, as units owed.
import type { Prisma, ProductStatus } from '@prisma/client'

type Tx = Prisma.TransactionClient

export class OutOfStockError extends Error {
  constructor(readonly variantIds: string[]) {
    super('Out of stock')
  }
}

export type ReserveLine = { variantId: string; quantity: number; status: ProductStatus }

/** Takes the stock of every line or none (throws OutOfStockError, and the caller's transaction rolls back). */
export async function reserveStock(tx: Tx, orderId: string, lines: ReserveLine[]) {
  const short: string[] = []
  // A stable order of updates, so two orders with the same products never deadlock.
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    const presale = line.status === 'PRESALE'
    const rows = presale
      ? await tx.$queryRaw<{ stock: number }[]>`UPDATE product_variants SET stock = stock - ${line.quantity}, updated_at = now() WHERE id = ${line.variantId} RETURNING stock`
      : await tx.$queryRaw<{ stock: number }[]>`UPDATE product_variants SET stock = stock - ${line.quantity}, updated_at = now() WHERE id = ${line.variantId} AND stock >= ${line.quantity} RETURNING stock`
    if (!rows.length) {
      short.push(line.variantId)
      continue
    }
    await tx.stockReservation.create({ data: { orderId, variantId: line.variantId, quantity: line.quantity } })
    await tx.inventoryMovement.create({ data: { variantId: line.variantId, type: 'RESERVATION', quantity: -line.quantity, stockAfter: rows[0]!.stock, orderId, actor: 'sistema' } })
  }
  if (short.length) throw new OutOfStockError(short)
}

/** Gives back what an order still holds. Idempotent: a released or committed reservation is skipped. */
export async function releaseStock(tx: Tx, orderId: string, note: string) {
  const active = await tx.stockReservation.findMany({ where: { orderId, status: 'ACTIVE' } })
  for (const r of active) {
    // Claim the reservation first: a concurrent release finds nothing to claim.
    const claimed = await tx.stockReservation.updateMany({ where: { id: r.id, status: 'ACTIVE' }, data: { status: 'RELEASED', resolvedAt: new Date() } })
    if (!claimed.count) continue
    const rows = await tx.$queryRaw<{ stock: number }[]>`UPDATE product_variants SET stock = stock + ${r.quantity}, updated_at = now() WHERE id = ${r.variantId} RETURNING stock`
    await tx.inventoryMovement.create({ data: { variantId: r.variantId, type: 'RELEASE', quantity: r.quantity, stockAfter: rows[0]?.stock ?? 0, orderId, note, actor: 'sistema' } })
  }
}

/** A paid order keeps what it reserved. */
export async function commitStock(tx: Tx, orderId: string) {
  await tx.stockReservation.updateMany({ where: { orderId, status: 'ACTIVE' }, data: { status: 'COMMITTED', resolvedAt: new Date() } })
}

/** Refunded units put back on the shelf (PED-03). */
export async function returnStock(tx: Tx, orderId: string, variantId: string, quantity: number, actor: string) {
  if (quantity <= 0) return
  const rows = await tx.$queryRaw<{ stock: number }[]>`UPDATE product_variants SET stock = stock + ${quantity}, updated_at = now() WHERE id = ${variantId} RETURNING stock`
  if (rows.length) await tx.inventoryMovement.create({ data: { variantId, type: 'RETURN', quantity, stockAfter: rows[0]!.stock, orderId, actor } })
}

/** A correction from the panel: count, damage, a delivery. Never below zero. */
export async function adjustStock(tx: Tx, variantId: string, delta: number, note: string, actor: string) {
  const rows = await tx.$queryRaw<{ stock: number }[]>`UPDATE product_variants SET stock = stock + ${delta}, updated_at = now() WHERE id = ${variantId} AND stock + ${delta} >= 0 RETURNING stock`
  if (!rows.length) throw new Error('El stock no puede quedar negativo.')
  await tx.inventoryMovement.create({ data: { variantId, type: 'ADJUSTMENT', quantity: delta, stockAfter: rows[0]!.stock, note, actor } })
  return rows[0]!.stock
}
