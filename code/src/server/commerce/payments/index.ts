// How a payment reaches an order (CMP-04, CMP-05, IR-14).
//
// Mercado Pago: a notification is stored once by its key (a replay is a
// no-op), then the payment is read again from the provider, and only that
// reading moves the order. The move itself is idempotent too: an order that
// is already paid stays paid. A pending cash voucher extends the reservation.
//
// Transfer: the order waits for the receipt; the customer uploads it from the
// confirmation or the email; the team confirms it in the panel. Without a
// receipt the order is cancelled when the reservation ends; with one, it
// waits for review (CK-08).
import type { Prisma, PrismaClient } from '@prisma/client'
import { loadSettings } from '@/server/settings'
import { enqueueEmail } from '@/server/email'
import { addOrderEvent, dayLabel, hourLabel, lockOrder, moveOrder, orderPath, orderVars, type OrderActor } from '../orders'
import { OutOfStockError, reserveStock } from '../stock'
import { MercadoPagoProvider } from './mercadopago'
import type { PaymentProvider, ProviderPayment } from './provider'
import { SimulatorProvider } from './simulator'

export type { PaymentProvider } from './provider'

const PROVIDER_ACTOR: Record<string, OrderActor> = {
  mercadopago: { type: 'PROVIDER', label: 'Mercado Pago' },
  simulator: { type: 'PROVIDER', label: 'Simulador de pagos' },
}

/** Mercado Pago with credentials (test or live, IR-33); the simulator only when asked for and never in production. */
export function paymentProvider(db: PrismaClient): PaymentProvider | null {
  if (process.env.MP_ACCESS_TOKEN) return new MercadoPagoProvider(process.env.MP_ACCESS_TOKEN, process.env.MP_WEBHOOK_SECRET || null)
  if (process.env.PAYMENTS_SIMULATOR === '1' && process.env.NODE_ENV !== 'production') return new SimulatorProvider(db)
  return null
}

/** A webhook call: store it once, then act on the payment it names. */
export async function receiveNotification(db: PrismaClient, provider: PaymentProvider, req: { url: URL; headers: Headers; body: unknown }) {
  const n = provider.parseNotification(req)
  if (!n.ok) return { status: n.reason === 'not a payment notification' ? 200 : 401, reason: n.reason }
  const stored = await db.paymentNotification.createMany({
    data: [{ provider: provider.name, dedupeKey: n.dedupeKey, resourceId: n.paymentId, payload: { url: req.url.search, body: req.body ?? null } as Prisma.InputJsonValue }],
    skipDuplicates: true,
  })
  if (!stored.count) return { status: 200, reason: 'duplicate' }
  try {
    const result = await syncPayment(db, provider, n.paymentId)
    await db.paymentNotification.update({ where: { dedupeKey: n.dedupeKey }, data: { processedAt: new Date() } })
    return { status: 200, reason: result }
  } catch (e) {
    await db.paymentNotification.update({ where: { dedupeKey: n.dedupeKey }, data: { error: (e as Error).message.slice(0, 500) } })
    // A 500 makes Mercado Pago retry later; the retry has another key and runs again.
    throw e
  }
}

/** Reads the payment from the provider and brings the order in line with it. Safe to repeat. */
export async function syncPayment(db: PrismaClient, provider: PaymentProvider, paymentId: string): Promise<string> {
  const p = await provider.getPayment(paymentId)
  if (!p.orderId) return 'payment without order'
  const s = await loadSettings(db)
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, p.orderId!)
    const actor = PROVIDER_ACTOR[provider.name]!
    const before = await tx.payment.findUnique({ where: { externalId: p.id } })
    await tx.payment.upsert({
      where: { externalId: p.id },
      create: { orderId: order.id, provider: provider.name, externalId: p.id, status: p.status, statusDetail: p.statusDetail, method: p.method, installments: p.installments, amountCents: p.amountCents, raw: json(p.raw) },
      update: { status: p.status, statusDetail: p.statusDetail, method: p.method, installments: p.installments, amountCents: p.amountCents, raw: json(p.raw) },
    })
    if (before?.status !== p.status) {
      await addOrderEvent(tx, order.id, actor, { type: 'payment', message: paymentMessage(p), data: { paymentId: p.id, status: p.status, detail: p.statusDetail, method: p.method, installments: p.installments } })
    }

    if (p.status === 'approved') {
      if (p.amountCents < order.totalCents) {
        await addOrderEvent(tx, order.id, actor, { type: 'note', message: `El pago aprobado (${p.amountCents / 100}) es menor que el total del pedido. Revisar antes de despachar.` })
      }
      if (order.status === 'PENDING_PAYMENT') {
        await moveOrder(tx, order.id, 'PAID', actor, { message: 'Pago aprobado', settings: s })
        return 'paid'
      }
      if (order.status === 'CANCELLED') {
        // The money arrived after the reservation ended: take the stock again if it is still there.
        try {
          await reserveStock(tx, order.id, await reserveLinesFor(tx, order.id))
          await tx.order.update({ where: { id: order.id }, data: { status: 'PENDING_PAYMENT', cancelledAt: null } })
          await addOrderEvent(tx, order.id, actor, { type: 'status', from: 'CANCELLED', to: 'PENDING_PAYMENT', message: 'Pago aprobado después del vencimiento: se reservó el stock otra vez.' })
          await moveOrder(tx, order.id, 'PAID', actor, { message: 'Pago aprobado', settings: s })
          return 'paid late'
        } catch (e) {
          if (!(e instanceof OutOfStockError)) throw e
          await addOrderEvent(tx, order.id, actor, { type: 'note', message: 'Pago aprobado después del vencimiento y ya no hay stock: hay que reembolsarlo.' })
          console.error(`[payments] order ${order.number}: approved after expiry, no stock left; needs a refund`)
          return 'paid late, no stock'
        }
      }
      return 'already paid'
    }

    if ((p.status === 'pending' || p.status === 'in_process') && order.status === 'PENDING_PAYMENT' && p.method === 'ticket') {
      // IR-14: a cash voucher was issued; keep the stock for the voucher's time.
      const until = new Date(Date.now() + s['commerce.cashReservationHours'] * 3_600_000)
      if (!order.reservedUntil || order.reservedUntil < until) await tx.order.update({ where: { id: order.id }, data: { reservedUntil: until } })
      return 'pending cash'
    }

    if (p.status === 'refunded' || p.status === 'charged_back') {
      await addOrderEvent(tx, order.id, actor, { type: 'note', message: p.status === 'charged_back' ? 'Contracargo informado por Mercado Pago.' : 'Mercado Pago informa el pago como devuelto.' })
    }
    return p.status
  })
}

function paymentMessage(p: ProviderPayment): string {
  const how = p.method === 'ticket' ? 'en efectivo' : p.method === 'account_money' ? 'con dinero en cuenta' : p.installments && p.installments > 1 ? `en ${p.installments} cuotas` : ''
  const what = { approved: 'aprobado', pending: 'pendiente', in_process: 'en revisión', rejected: 'rechazado', cancelled: 'cancelado', refunded: 'devuelto', charged_back: 'contracargado' }[p.status] ?? p.status
  return `Pago ${what}${how ? ` ${how}` : ''}`
}

async function reserveLinesFor(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } }, include: { variant: { include: { product: { select: { status: true } } } } } })
  await tx.stockReservation.deleteMany({ where: { orderId } })
  return items.map((i) => ({ variantId: i.variantId!, quantity: i.quantity, status: i.variant!.product.status }))
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue

// ------------------------------------------------------------- transfer ----

/** The customer's receipt (CMP-05): from then on the order waits for review instead of expiring. */
export async function attachTransferReceipt(db: PrismaClient, orderId: string, storageKey: string, actor: OrderActor) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    if (order.paymentMethod !== 'TRANSFER' || order.status !== 'PENDING_PAYMENT') return false
    const payment = await tx.payment.findFirst({ where: { orderId, provider: 'transfer' }, orderBy: { createdAt: 'desc' } })
    if (!payment) return false
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'receipt_uploaded', receipt: storageKey, receiptAt: new Date() } })
    await addOrderEvent(tx, orderId, actor, { type: 'payment', message: 'Comprobante de transferencia cargado: esperando revisión.' })
    return true
  })
}

/** The team saw the money in the account. */
export async function confirmTransfer(db: PrismaClient, orderId: string, admin: { id: string; email: string }) {
  const s = await loadSettings(db)
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    if (order.paymentMethod !== 'TRANSFER') throw new Error('El pedido no es por transferencia.')
    const actor: OrderActor = { type: 'ADMIN', id: admin.id, label: admin.email }
    await tx.payment.updateMany({ where: { orderId, provider: 'transfer' }, data: { status: 'approved', reviewedBy: admin.email, reviewedAt: new Date() } })
    if (order.status === 'CANCELLED') {
      await reserveStock(tx, order.id, await reserveLinesFor(tx, order.id))
      await tx.order.update({ where: { id: order.id }, data: { status: 'PENDING_PAYMENT', cancelledAt: null } })
      await addOrderEvent(tx, order.id, actor, { type: 'status', from: 'CANCELLED', to: 'PENDING_PAYMENT', message: 'Transferencia confirmada después del vencimiento: se reservó el stock otra vez.' })
    }
    return moveOrder(tx, orderId, 'PAID', actor, { message: 'Transferencia confirmada', settings: s })
  })
}

/** The receipt does not match: back to waiting, with the reservation renewed so she can send the right one. */
export async function rejectTransferReceipt(db: PrismaClient, orderId: string, admin: { id: string; email: string }, note: string) {
  const s = await loadSettings(db)
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    if (order.status !== 'PENDING_PAYMENT') return false
    await tx.payment.updateMany({ where: { orderId, provider: 'transfer', status: 'receipt_uploaded' }, data: { status: 'awaiting_transfer', reviewedBy: admin.email, reviewedAt: new Date() } })
    const until = new Date(Date.now() + s['commerce.transferReservationHours'] * 3_600_000)
    await tx.order.update({ where: { id: orderId }, data: { reservedUntil: until, reminderSentAt: null } })
    await addOrderEvent(tx, orderId, { type: 'ADMIN', id: admin.id, label: admin.email }, { type: 'payment', message: `Comprobante rechazado: ${note}`.trim() })
    await enqueueEmail(
      tx,
      { template: 'transfer_reminder', to: order.email, vars: { ...orderVars(order), hora: hourLabel(until), dia: dayLabel(until), link_pedido: '' }, ctaPath: orderPath(order), related: { type: 'order', id: orderId } },
      s,
    )
    return true
  })
}
