// Commissions (EMB-03..EMB-05, EB-C01..EB-C05, IR-16, X-03).
//
//   paid         the order's resolved ambassador gets an Attribution and a
//                PENDING commission, in the same transaction; both are unique
//                per order, so an order never pays two ambassadors
//   delivered    + approvalDays → APPROVED (or dispatched + N days when the
//                delivery date is unknown)
//   refund       before payout: the commission is reduced, or cancelled when
//                the refund is total; after payout: a negative adjustment is
//                deducted from the next settlement
//   month end    APPROVED commissions and pending adjustments of each
//                ambassador become one settlement if they reach the minimum;
//                otherwise they wait for the next month
import type { Order, OrderItem, Prisma, PrismaClient } from '@prisma/client'
import { commissionFor } from '@/lib/commerce/attribution'
import { formatARS } from '@/lib/money'
import { enqueueEmail } from '@/server/email'
import type { SettingValues } from '@/server/settings'

type Tx = Prisma.TransactionClient
const DAY = 86_400_000

/** Called when an order moves to PAID. Idempotent. */
export async function createCommissionForOrder(tx: Tx, orderId: string, s: SettingValues) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, ambassador: true, commission: true } })
  if (!order?.ambassadorId || !order.ambassador || order.commission || order.ambassador.status !== 'APPROVED') return null
  const products = await tx.product.findMany({ where: { id: { in: order.items.map((i) => i.productId).filter((x): x is string => !!x) } }, select: { id: true, vatRate: true, commissionPct: true } })
  const byId = new Map(products.map((p) => [p.id, p]))
  const general = s['ambassadors.commissionPct']
  const own = order.ambassador.commissionPct != null ? Number(order.ambassador.commissionPct) : null
  const calc = commissionFor(
    order.items.map((i) => {
      const p = i.productId ? byId.get(i.productId) : undefined
      return {
        orderItemId: i.id,
        totalCents: i.totalCents,
        vatPct: p?.vatRate != null ? Number(p.vatRate) : s['catalog.vatRate'],
        ratePct: p?.commissionPct != null ? Number(p.commissionPct) : (own ?? general),
      }
    }),
    s['ambassadors.baseWithoutVat'],
  )
  await tx.attribution.create({ data: { orderId, ambassadorId: order.ambassadorId, source: order.attributionSource ?? 'CODE', code: order.ambassadorCode ?? order.ambassador.code ?? '' } })
  return tx.commission.create({
    data: {
      orderId,
      ambassadorId: order.ambassadorId,
      baseCents: calc.baseCents,
      amountCents: calc.amountCents,
      lines: calc.lines as unknown as Prisma.InputJsonValue,
      withoutVat: s['ambassadors.baseWithoutVat'],
    },
  })
}

/** Called by every refund (X-03). */
export async function commissionOnRefund(tx: Tx, order: Order & { items: OrderItem[] }, refund: { id: string; amountCents: number; total: boolean; lines: { orderItemId: string; quantity: number }[] }) {
  const c = await tx.commission.findUnique({ where: { orderId: order.id } })
  if (!c || c.status === 'CANCELLED') return
  const lines = c.lines as { orderItemId: string; amountCents: number }[]
  // What the refunded units had earned.
  let lost = refund.total ? c.amountCents : 0
  if (!refund.total) {
    for (const r of refund.lines) {
      const item = order.items.find((i) => i.id === r.orderItemId)
      const line = lines.find((l) => l.orderItemId === r.orderItemId)
      if (item && line && item.quantity > 0) lost += Math.round((line.amountCents * Math.min(r.quantity, item.quantity)) / item.quantity)
    }
  }
  lost = Math.min(lost, c.amountCents)
  if (lost <= 0) return
  if (c.status === 'PAID') {
    await tx.commissionAdjustment.create({ data: { ambassadorId: c.ambassadorId, orderId: order.id, amountCents: -lost, reason: `Reembolso del pedido #${order.number} después de pagada la comisión` } })
    return
  }
  const remaining = c.amountCents - lost
  if (refund.total || remaining <= 0) {
    await tx.commission.update({ where: { id: c.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: `Reembolso ${refund.total ? 'total' : ''} del pedido #${order.number}`.replace('  ', ' ') } })
  } else {
    await tx.commission.update({ where: { id: c.id }, data: { amountCents: remaining } })
  }
}

/** An order cancelled before payment never had a commission; one cancelled after is a refund. Nothing to do here. */

/** EB-C04: PENDING → APPROVED once the return window has passed. Run by the sweep. */
export async function approveDueCommissions(db: PrismaClient, s: SettingValues, now = new Date()) {
  const pending = await db.commission.findMany({ where: { status: 'PENDING' }, include: { order: { select: { status: true, deliveredAt: true, shippedAt: true } } } })
  let n = 0
  for (const c of pending) {
    const o = c.order
    if (!['DELIVERED', 'SHIPPED', 'PARTIALLY_REFUNDED'].includes(o.status)) continue
    const due = o.deliveredAt ? o.deliveredAt.getTime() + s['ambassadors.approvalDays'] * DAY : o.shippedAt ? o.shippedAt.getTime() + s['ambassadors.approvalFromDispatchDays'] * DAY : null
    if (due == null || due > now.getTime()) continue
    const done = await db.commission.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { status: 'APPROVED', approvedAt: now } })
    n += done.count
  }
  return n
}

const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
export const periodOf = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }).format(d)
  return parts.slice(0, 7)
}
/** The first instant of the month after the period, Buenos Aires time. */
export function periodEnd(period: string): Date {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 3)) // 00:00 ART = 03:00 UTC
}

/**
 * EB-C05: the month's settlement. For each ambassador, the commissions
 * approved before the month ended plus the pending deductions; if the total
 * reaches the minimum, one settlement is created and she is emailed (EM-18).
 */
export async function settleMonth(db: PrismaClient, s: SettingValues, period: string, actorEmail: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Período inválido')
  const end = periodEnd(period)
  if (end.getTime() > Date.now()) throw new Error('El mes todavía no terminó.')
  const ambassadors = await db.ambassador.findMany({ where: { commissions: { some: { status: 'APPROVED', payoutId: null, approvedAt: { lt: end } } } }, select: { id: true } })
  const withAdjustments = await db.commissionAdjustment.findMany({ where: { payoutId: null }, select: { ambassadorId: true } })
  const ids = [...new Set([...ambassadors.map((a) => a.id), ...withAdjustments.map((a) => a.ambassadorId)])]
  const created: string[] = []
  for (const id of ids) {
    await db.$transaction(async (tx) => {
      if (await tx.commissionPayout.findUnique({ where: { ambassadorId_period: { ambassadorId: id, period } } })) return
      const commissions = await tx.commission.findMany({ where: { ambassadorId: id, status: 'APPROVED', payoutId: null, approvedAt: { lt: end } } })
      const adjustments = await tx.commissionAdjustment.findMany({ where: { ambassadorId: id, payoutId: null } })
      const amount = commissions.reduce((a, c) => a + c.amountCents, 0) + adjustments.reduce((a, x) => a + x.amountCents, 0)
      if (amount <= 0 || amount < s['ambassadors.minimumPayoutCents']) return // carried to next month
      const payout = await tx.commissionPayout.create({ data: { ambassadorId: id, period, amountCents: amount, createdBy: actorEmail } })
      await tx.commission.updateMany({ where: { id: { in: commissions.map((c) => c.id) } }, data: { payoutId: payout.id } })
      await tx.commissionAdjustment.updateMany({ where: { id: { in: adjustments.map((x) => x.id) } }, data: { payoutId: payout.id } })
      const amb = await tx.ambassador.findUniqueOrThrow({ where: { id } })
      const invoiceTo = s['company.legalName'] ? ` a nombre de ${s['company.legalName']}${s['company.cuit'] ? ` (CUIT ${s['company.cuit']})` : ''}${s['company.email'] ? `, a ${s['company.email']}` : ''}` : ''
      await enqueueEmail(
        tx,
        {
          template: 'ambassador_settlement',
          to: amb.email,
          vars: { nombre: amb.firstName, mes: monthName.format(new Date(end.getTime() - DAY)), monto: formatARS(amount), compras: commissions.length, factura: invoiceTo },
          ctaPath: '/embajadoras/panel',
          dedupeKey: `payout:${payout.id}`,
          related: { type: 'ambassador', id },
        },
        s,
      )
      created.push(payout.id)
    })
  }
  return created
}

/** EB-C06: paid by transfer against her invoice; the panel records the invoice number. */
export async function markPayoutPaid(db: PrismaClient, payoutId: string, invoiceNumber: string) {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const p = await tx.commissionPayout.update({ where: { id: payoutId }, data: { paidAt: now, invoiceNumber: invoiceNumber.trim() || null } })
    await tx.commission.updateMany({ where: { payoutId }, data: { status: 'PAID', paidAt: now } })
    return p
  })
}
