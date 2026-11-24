// Refunds (PED-03): partial or total, by line, with the units optionally back
// in stock. With Mercado Pago the refund is made through its API and Mercado
// Pago credits it on its own schedule; with a transfer, LaRutina transfers the
// money and records it here (AY, Ravi's note). Each refund updates stock,
// analytics and the ambassador's commission (X-03: the hook is here, the
// commissions arrive in H3).
import type { Order, OrderItem, Prisma, PrismaClient } from '@prisma/client'
import { formatARS } from '@/lib/money'
import { enqueueEmail } from '@/server/email'
import { loadSettings } from '@/server/settings'
import { addOrderEvent, lockOrder, moveOrder, orderVars, type OrderActor } from './orders'
import { paymentProvider, type PaymentProvider } from './payments'
import { returnStock } from './stock'
import { commissionOnRefund } from '@/server/ambassadors/commissions'

type Tx = Prisma.TransactionClient

export type RefundLine = { orderItemId: string; quantity: number; restock: boolean }
export type RefundInput = { lines: RefundLine[]; includeShipping: boolean; reason: string; amountCents?: number | null }

/** Commission hook (X-03). H3 cancels the pending commission or deducts it from the next payout. */
export type RefundHook = (tx: Tx, order: Order & { items: OrderItem[] }, refund: { id: string; amountCents: number; total: boolean }) => Promise<void>
const hooks: RefundHook[] = []
export function onRefund(hook: RefundHook) {
  hooks.push(hook)
}

/** What a refund of these lines comes to: each unit at its share after discounts. */
export function refundAmount(order: Pick<Order, 'shippingCents'> & { items: Pick<OrderItem, 'id' | 'quantity' | 'totalCents'>[] }, lines: RefundLine[], includeShipping: boolean): number {
  let cents = 0
  for (const l of lines) {
    const item = order.items.find((i) => i.id === l.orderItemId)
    if (!item || l.quantity <= 0) continue
    cents += Math.round((item.totalCents * Math.min(l.quantity, item.quantity)) / item.quantity)
  }
  return cents + (includeShipping ? order.shippingCents : 0)
}

export class RefundError extends Error {}

export async function refundOrder(db: PrismaClient, orderId: string, admin: { id: string; email: string }, input: RefundInput, deps: { payments?: PaymentProvider | null } = {}) {
  const s = await loadSettings(db)
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, refunds: true, payments: true } })
  if (!order) throw new RefundError('Pedido inexistente.')
  if (!['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status)) throw new RefundError('Solo se reembolsa un pedido pagado.')
  if (!input.reason.trim()) throw new RefundError('Escribí el motivo del reembolso.')

  for (const l of input.lines) {
    const item = order.items.find((i) => i.id === l.orderItemId)
    if (!item) throw new RefundError('Una línea no pertenece al pedido.')
    if (l.quantity < 0 || l.quantity > item.quantity - item.refundedQuantity) throw new RefundError(`De ${item.productName} quedan ${item.quantity - item.refundedQuantity} por reembolsar.`)
  }
  const alreadyRefunded = order.refunds.reduce((a, r) => a + r.amountCents, 0)
  const remaining = order.totalCents - alreadyRefunded
  const computed = refundAmount(order, input.lines, input.includeShipping)
  const amountCents = input.amountCents != null ? Math.round(input.amountCents) : computed
  if (amountCents <= 0) throw new RefundError('El importe del reembolso tiene que ser mayor que cero.')
  if (amountCents > remaining) throw new RefundError(`El pedido tiene ${formatARS(remaining)} para reembolsar.`)
  const total = amountCents === remaining

  // Mercado Pago first, outside the transaction: if it refuses, nothing changes here.
  let providerRefundId: string | null = null
  const approved = order.payments.find((p) => p.status === 'approved' && p.externalId && (p.provider === 'mercadopago' || p.provider === 'simulator'))
  if (order.paymentMethod === 'MERCADOPAGO') {
    const provider = deps.payments === undefined ? paymentProvider(db) : deps.payments
    if (!approved || !provider) throw new RefundError('No se encontró el pago aprobado en Mercado Pago.')
    const r = await provider.refund(approved.externalId!, total && alreadyRefunded === 0 ? null : amountCents, `refund-${order.id}-${alreadyRefunded}-${amountCents}`)
    providerRefundId = r.id
  }

  const actor: OrderActor = { type: 'ADMIN', id: admin.id, label: admin.email }
  return db.$transaction(async (tx) => {
    const locked = await lockOrder(tx, orderId)
    const refund = await tx.refund.create({
      data: { orderId, amountCents, total, reason: input.reason.trim(), items: input.lines.filter((l) => l.quantity > 0) as unknown as Prisma.InputJsonValue, providerRefundId, createdBy: admin.email },
    })
    for (const l of input.lines) {
      if (l.quantity <= 0) continue
      const item = locked.items.find((i) => i.id === l.orderItemId)!
      await tx.orderItem.update({ where: { id: item.id }, data: { refundedQuantity: { increment: l.quantity } } })
      if (l.restock && item.variantId) await returnStock(tx, orderId, item.variantId, l.quantity, admin.email)
    }
    await addOrderEvent(tx, orderId, actor, {
      type: 'refund',
      message: `Reembolso ${total ? 'total' : 'parcial'} de ${formatARS(amountCents)}: ${input.reason.trim()}`,
      data: { refundId: refund.id, amountCents, providerRefundId, lines: input.lines },
    })
    const updated = await moveOrder(tx, orderId, total ? 'REFUNDED' : 'PARTIALLY_REFUNDED', actor, { message: total ? 'Reembolso total' : 'Reembolso parcial', settings: s })
    await enqueueEmail(
      tx,
      {
        template: 'refund',
        to: updated.email,
        vars: { ...orderVars(updated), monto: formatARS(amountCents), medio: order.paymentMethod === 'TRANSFER' ? 'transferencia' : 'Mercado Pago', plazo: 'unos días hábiles' },
        dedupeKey: `refund:${refund.id}`,
        related: { type: 'order', id: orderId },
      },
      s,
    )
    await commissionOnRefund(tx, updated, { id: refund.id, amountCents, total, lines: input.lines.filter((l) => l.quantity > 0) })
    for (const hook of hooks) await hook(tx, updated, { id: refund.id, amountCents, total })
    return refund
  })
}
