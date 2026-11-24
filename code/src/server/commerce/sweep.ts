// The background work of commerce, run every minute by the sweep endpoint
// (app/api/jobs/sweep). Each task picks up what is due and is safe to repeat:
// the state it changes is the state it selects on.
//
//   expire       unpaid orders past their reservation: cancelled, stock back (CMP-05, PED-02)
//   remind       transfer at 3 h, cash voucher at 24 h (CMP-05, IR-14)
//   abandoned    one email 24 h after the checkout email was left (EML-04)
//   reviews      N days after delivery, to who bought (EML-03)
//   backInStock  once, when stock comes back (NAV-07)
//   emails       the outbox
import type { PrismaClient } from '@prisma/client'

import { enqueueEmail, sendQueuedEmails, siteUrl } from '@/server/email'
import { loadSettings, type SettingValues } from '@/server/settings'
import { sign } from '@/server/secret'
import { publishedProductWhere, variantAvailable } from '@/server/services/catalog/rules'
import { bankDetails, dayLabel, hourLabel, moveOrder, orderPath, orderVars, SYSTEM } from './orders'

const HOUR = 3_600_000

export async function expireOrders(db: PrismaClient, s: SettingValues, now = new Date()) {
  const due = await db.order.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      reservedUntil: { lt: now },
      // CK-08: a transfer with its receipt uploaded waits for review instead.
      NOT: { payments: { some: { status: { in: ['receipt_uploaded', 'approved'] } } } },
    },
    select: { id: true, paymentMethod: true, payments: { select: { status: true, method: true } } },
    take: 100,
  })
  let n = 0
  for (const o of due) {
    const hadPendingPayment = o.payments.some((p) => p.status === 'pending' || p.status === 'in_process')
    await db.$transaction((tx) =>
      moveOrder(tx, o.id, 'CANCELLED', SYSTEM, {
        message: 'Venció la reserva sin pago',
        cancelReason: o.paymentMethod === 'TRANSFER' ? 'transfer_expired' : 'payment_expired',
        data: { hadPendingPayment },
        settings: s,
      }),
    )
    n++
  }
  return n
}

export async function sendReminders(db: PrismaClient, s: SettingValues, now = new Date()) {
  let n = 0
  // Transfer: the reminder at `transferReminderHours` after placing (EM-03).
  const transferBefore = new Date(now.getTime() - s['commerce.transferReminderHours'] * HOUR)
  const transfers = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', paymentMethod: 'TRANSFER', reminderSentAt: null, placedAt: { lte: transferBefore }, reservedUntil: { gt: now }, payments: { none: { status: 'receipt_uploaded' } } },
    take: 100,
  })
  for (const o of transfers) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id: o.id, reminderSentAt: null }, data: { reminderSentAt: now } })
      if (!claimed.count) return
      await enqueueEmail(
        tx,
        {
          template: 'transfer_reminder',
          to: o.email,
          vars: { ...orderVars(o), hora: hourLabel(o.reservedUntil!), dia: dayLabel(o.reservedUntil!), link_pedido: `${siteUrl(s)}${orderPath(o)}` },
          ctaPath: orderPath(o),
          blocks: { datos_bancarios: bankDetails(s) },
          dedupeKey: `order:${o.id}:transfer-reminder:${o.reservedUntil!.getTime()}`,
          related: { type: 'order', id: o.id },
        },
        s,
      )
    })
    n++
  }
  // Cash voucher: the reminder at `cashReminderHours` after the voucher (IR-14).
  const cashBefore = new Date(now.getTime() - s['commerce.cashReminderHours'] * HOUR)
  const cash = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', paymentMethod: 'MERCADOPAGO', reminderSentAt: null, reservedUntil: { gt: now }, payments: { some: { method: 'ticket', status: { in: ['pending', 'in_process'] }, createdAt: { lte: cashBefore } } } },
    take: 100,
  })
  for (const o of cash) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id: o.id, reminderSentAt: null }, data: { reminderSentAt: now } })
      if (!claimed.count) return
      await enqueueEmail(
        tx,
        { template: 'cash_reminder', to: o.email, vars: { ...orderVars(o), hora: hourLabel(o.reservedUntil!), dia: dayLabel(o.reservedUntil!) }, ctaPath: orderPath(o), dedupeKey: `order:${o.id}:cash-reminder`, related: { type: 'order', id: o.id } },
        s,
      )
    })
    n++
  }
  return n
}

/** "[producto / tu rutina]" (EM-09). */
export function cartProductsPhrase(lines: { name: string; routineGroup: string | null }[]): string {
  if (lines.some((l) => l.routineGroup)) return 'tu rutina'
  if (lines.length === 1) return lines[0]!.name
  if (lines.length === 2) return `${lines[0]!.name} y ${lines[1]!.name}`
  return `${lines[0]!.name} y ${lines.length - 1} productos más`
}

export async function sendAbandonedCarts(db: PrismaClient, s: SettingValues, now = new Date()) {
  const hours = s['commerce.abandonedCartHours']
  if (!(hours > 0)) return 0
  const carts = await db.cart.findMany({
    where: { email: { not: null }, convertedAt: null, abandonedEmailSentAt: null, updatedAt: { lte: new Date(now.getTime() - hours * HOUR) }, items: { some: {} } },
    include: { items: { include: { variant: { include: { product: { select: { name: true, status: true, deletedAt: true } } } } } } },
    take: 100,
  })
  let n = 0
  for (const cart of carts) {
    // Nothing left that can be bought: no email.
    const lines = cart.items.filter((i) => !i.variant.product.deletedAt && variantAvailable(i.variant.product.status, i.variant.stock))
    // She already bought (a placed order from this cart, or with this email since).
    const bought = await db.order.count({ where: { OR: [{ cartId: cart.id }, { email: cart.email! }], placedAt: { gte: cart.updatedAt } } })
    await db.$transaction(async (tx) => {
      const claimed = await tx.cart.updateMany({ where: { id: cart.id, abandonedEmailSentAt: null }, data: { abandonedEmailSentAt: now } })
      if (!claimed.count || !lines.length || bought) return
      await enqueueEmail(
        tx,
        {
          template: 'cart_abandoned',
          to: cart.email!,
          vars: { productos_carrito: cartProductsPhrase(lines.map((l) => ({ name: l.variant.product.name, routineGroup: l.routineGroup }))) },
          ctaPath: `/carrito/recuperar/${cart.id}?t=${sign('cart', cart.id)}`,
          dedupeKey: `cart:${cart.id}:abandoned`,
          related: { type: 'cart', id: cart.id },
        },
        s,
      )
      n++
    })
  }
  return n
}

export async function sendReviewRequests(db: PrismaClient, s: SettingValues, now = new Date()) {
  const days = s['commerce.reviewRequestDays']
  if (!(days > 0)) return 0
  const orders = await db.order.findMany({
    where: { status: { in: ['DELIVERED', 'PARTIALLY_REFUNDED'] }, deliveredAt: { lte: new Date(now.getTime() - days * 24 * HOUR) }, reviewRequestSentAt: null, anonymizedAt: null },
    include: { items: true },
    take: 100,
  })
  let n = 0
  for (const o of orders) {
    const reviewable = o.items.filter((i) => i.productId && i.refundedQuantity < i.quantity)
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id: o.id, reviewRequestSentAt: null }, data: { reviewRequestSentAt: now } })
      if (!claimed.count || !reviewable.length) return
      await enqueueEmail(
        tx,
        { template: 'review_request', to: o.email, vars: { ...orderVars(o), producto: reviewable[0]!.productName }, ctaPath: `/resenas/${o.number}?t=${sign('review', o.id)}`, dedupeKey: `order:${o.id}:review-request`, related: { type: 'order', id: o.id } },
        s,
      )
      n++
    })
  }
  return n
}

export async function sendBackInStock(db: PrismaClient, s: SettingValues, now = new Date()) {
  const requests = await db.backInStockRequest.findMany({
    where: { notifiedAt: null, variant: { stock: { gt: 0 }, product: publishedProductWhere() } },
    include: { variant: { include: { product: { select: { code: true, name: true, status: true } } } } },
    take: 200,
  })
  let n = 0
  for (const r of requests) {
    if (!variantAvailable(r.variant.product.status, r.variant.stock)) continue
    await db.$transaction(async (tx) => {
      const claimed = await tx.backInStockRequest.updateMany({ where: { id: r.id, notifiedAt: null }, data: { notifiedAt: now } })
      if (!claimed.count) return
      await enqueueEmail(
        tx,
        { template: 'back_in_stock', to: r.email, vars: { producto: r.variant.product.name }, ctaPath: `/producto/${r.variant.product.code}`, dedupeKey: `back-in-stock:${r.id}`, related: { type: 'variant', id: r.variantId } },
        s,
      )
      n++
    })
  }
  return n
}

export async function runSweep(db: PrismaClient, now = new Date()) {
  const s = await loadSettings(db)
  const result = {
    expired: await expireOrders(db, s, now),
    reminders: await sendReminders(db, s, now),
    abandoned: await sendAbandonedCarts(db, s, now),
    reviews: await sendReviewRequests(db, s, now),
    backInStock: await sendBackInStock(db, s, now),
    emails: await sendQueuedEmails(db),
  }
  return result
}


