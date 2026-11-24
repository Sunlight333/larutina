// Order state changes (PED-01): every move is checked against the state
// machine, recorded as an OrderEvent with its author, and does what that
// state needs in the same transaction: stock committed or released, the
// shipment opened, the customer's email queued once.
import type { ActorType, Order, OrderItem, OrderStatus, Prisma, PrismaClient } from '@prisma/client'
import { canMove } from '@/lib/commerce/order-status'
import { formatARS } from '@/lib/money'
import { enqueueEmail } from '@/server/email'
import type { EmailBank, EmailDetail } from '@/server/email/render'
import { CANCEL_REASONS, type CancelReason } from '@/server/email/templates'
import { loadSettings, type SettingValues } from '@/server/settings'
import { sign } from '@/server/secret'
import { commitStock, releaseStock } from './stock'

type Tx = Prisma.TransactionClient

export type OrderActor = { type: ActorType; id?: string | null; label?: string | null }
export const SYSTEM: OrderActor = { type: 'SYSTEM', label: 'Sistema' }

export class OrderStateError extends Error {}

const STAMP: Partial<Record<OrderStatus, keyof Order>> = {
  PAID: 'paidAt',
  PREPARING: 'preparingAt',
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
  CANCELLED: 'cancelledAt',
  REFUNDED: 'refundedAt',
}

/** Locks the order row for the rest of the transaction, so two moves never interleave. */
export async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, shipment: true } })
  if (!order) throw new OrderStateError('Pedido inexistente.')
  return order
}

export async function addOrderEvent(tx: Tx, orderId: string, actor: OrderActor, e: { type: string; message?: string | null; data?: unknown; from?: OrderStatus | null; to?: OrderStatus | null }) {
  await tx.orderEvent.create({
    data: {
      orderId,
      type: e.type,
      message: e.message ?? null,
      data: e.data === undefined ? undefined : (JSON.parse(JSON.stringify(e.data)) as Prisma.InputJsonValue),
      fromStatus: e.from ?? null,
      toStatus: e.to ?? null,
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorLabel: actor.label ?? null,
    },
  })
}

/** The order page, signed so the link in an email opens it without asking for the email again (PED-05). */
export const orderPath = (o: Pick<Order, 'id' | 'number'>) => `/pedido/${o.number}?t=${sign('order', o.id)}`

export function orderDetail(order: Order & { items: OrderItem[] }): EmailDetail {
  return {
    lines: order.items.map((i) => ({ name: i.productName, brand: i.brandName, size: i.sizeLabel, quantity: i.quantity, totalCents: i.totalCents })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
  }
}

export function bankDetails(s: SettingValues): EmailBank {
  return { holder: s['company.bankHolder'] || s['company.legalName'], cuit: s['company.cuit'], bank: s['company.bankName'], cbu: s['company.bankCbu'], alias: s['company.bankAlias'] }
}

export const transferConfigured = (s: SettingValues) => !!((s['company.bankHolder'] || s['company.legalName']) && (s['company.bankCbu'] || s['company.bankAlias']))

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
const dayFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
export const hourLabel = (d: Date) => timeFormat.format(d)
export const dayLabel = (d: Date) => dayFormat.format(d)

export function orderVars(order: Order) {
  return { nombre: order.firstName, numero: order.number, total: formatARS(order.totalCents) }
}

type MoveOptions = { message?: string | null; data?: unknown; cancelReason?: CancelReason; settings?: SettingValues }

/**
 * Moves an order to `to`. Throws OrderStateError when the move is not
 * allowed. Must run inside a transaction.
 */
export async function moveOrder(tx: Tx, orderId: string, to: OrderStatus, actor: OrderActor, opts: MoveOptions = {}) {
  const order = await lockOrder(tx, orderId)
  if (order.status === to && to !== 'PARTIALLY_REFUNDED') return order
  if (!canMove(order.status, to)) throw new OrderStateError(`No se puede pasar de ${order.status} a ${to}.`)
  const now = new Date()
  const stamp = STAMP[to]
  const updated = await tx.order.update({
    where: { id: orderId },
    data: { status: to, ...(stamp ? { [stamp]: now } : {}), ...(to === 'PAID' || to === 'CANCELLED' ? { reservedUntil: null } : {}) },
    include: { items: true, shipment: true },
  })
  await addOrderEvent(tx, orderId, actor, { type: 'status', from: order.status, to, message: opts.message, data: opts.data })

  const s = opts.settings ?? (await loadSettings(tx as unknown as PrismaClient))
  const related = { type: 'order', id: order.id }
  const vars = orderVars(updated)

  if (to === 'PAID') {
    await commitStock(tx, orderId)
    if (!updated.shipment) {
      const ship = updated.shipping as { provider?: string; carrier?: string; service?: string; boxCode?: string | null; weightGrams?: number }
      await tx.shipment.create({ data: { orderId, provider: ship.provider === 'tabla' || !ship.provider ? 'manual' : ship.provider, carrier: ship.carrier ?? null, service: ship.service ?? null, boxCode: ship.boxCode ?? null, weightGrams: ship.weightGrams ?? null } })
    }
    if (order.cartId) await tx.cart.updateMany({ where: { id: order.cartId }, data: { convertedAt: now } })
    await enqueueEmail(tx, { template: 'order_confirmed', to: updated.email, vars, ctaPath: orderPath(updated), blocks: { detalle: orderDetail(updated) }, dedupeKey: `order:${order.id}:paid`, related }, s)
  }

  if (to === 'CANCELLED') {
    await releaseStock(tx, orderId, `Pedido ${order.number} cancelado`)
    const reason = opts.cancelReason ?? 'team'
    // An unpaid card checkout the customer simply left is cancelled quietly:
    // there was never a reservation she was told about.
    const silent = reason === 'payment_expired' && order.paymentMethod === 'MERCADOPAGO' && !(opts.data as { hadPendingPayment?: boolean } | undefined)?.hadPendingPayment
    if (!silent) {
      await enqueueEmail(
        tx,
        { template: 'order_cancelled', to: updated.email, vars: { ...vars, motivo: CANCEL_REASONS[reason], devolucion: '' }, ctaPath: '/productos', dedupeKey: `order:${order.id}:cancelled`, related },
        s,
      )
    }
  }

  if (to === 'SHIPPED') {
    const sh = updated.shipment
    const ship = updated.shipping as { carrier?: string; minDays?: number; maxDays?: number }
    await enqueueEmail(
      tx,
      {
        template: 'order_shipped',
        to: updated.email,
        vars: { ...vars, correo: sh?.carrier ?? ship.carrier ?? 'el correo', dias_min: ship.minDays ?? '', dias_max: ship.maxDays ?? '', seguimiento: sh?.trackingCode ?? '—' },
        ctaPath: sh?.trackingUrl ?? orderPath(updated),
        dedupeKey: `order:${order.id}:shipped`,
        related,
      },
      s,
    )
  }

  if (to === 'DELIVERED') {
    await enqueueEmail(tx, { template: 'order_delivered', to: updated.email, vars, ctaPath: '/cuenta', dedupeKey: `order:${order.id}:delivered`, related }, s)
  }

  return updated
}

/** For the panel's order list and the account: what an order says at a glance. */
export function orderSummary(order: Order & { items: OrderItem[] }) {
  return {
    number: order.number,
    status: order.status,
    placedAt: order.placedAt,
    totalCents: order.totalCents,
    count: order.items.reduce((n, i) => n + i.quantity, 0),
  }
}
