// After the purchase: the withdrawal button (PED-04, LE-04), the order lookup
// without an account (PED-05, CU-20), back-in-stock requests (NAV-07, G-13)
// and verified reviews (PDP-07, F-06, F-22).
import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { isEmail, normalizePhone } from '@/lib/argentina'
import { enqueueEmail } from '@/server/email'
import { loadSettings } from '@/server/settings'
import { verify } from '@/server/secret'
import { addOrderEvent, orderPath } from './orders'

// ------------------------------------------------------------ withdrawal ----

export const WITHDRAWAL_DAYS = 10 // "10 días corridos desde que recibiste tu compra" (LE-04)

export const WITHDRAWAL_ERRORS = {
  number: 'Escribí el número de pedido.',
  contact: 'Escribí el email o el teléfono de la compra.',
}

const ORDER_NUMBER = /^#?\s*(LR-?)?\s*(\d{1,9})$/i
/** "#LR-000142", "lr000142" or "142" → "LR-000142". */
export function normalizeOrderNumber(input: string): string | null {
  const m = ORDER_NUMBER.exec(input.trim())
  return m ? `LR-${m[2]!.padStart(6, '0')}` : null
}

function withdrawalCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  return `ARR-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`
}

/**
 * The form needs no account (Res. SCI 424/2020). It is always received, even
 * when the order cannot be matched: the team checks it. The code goes out by
 * email at once when there is an email to send it to; it is also shown on
 * the screen.
 */
export async function requestWithdrawal(db: PrismaClient, input: { orderNumber: string; contact: string; reason: string }) {
  const number = normalizeOrderNumber(input.orderNumber)
  const contact = input.contact.trim()
  const errors: Partial<Record<'orderNumber' | 'contact', string>> = {}
  if (!input.orderNumber.trim()) errors.orderNumber = WITHDRAWAL_ERRORS.number
  if (!contact || (!isEmail(contact) && !normalizePhone(contact))) errors.contact = WITHDRAWAL_ERRORS.contact
  if (Object.keys(errors).length) return { ok: false as const, errors }

  const email = isEmail(contact) ? contact.toLowerCase() : null
  const phone = email ? null : normalizePhone(contact)
  const order = number ? await db.order.findUnique({ where: { number } }) : null
  const matches = !!order && ((email && order.email === email) || (phone && order.phone === phone))
  const s = await loadSettings(db)
  const code = withdrawalCode()

  const request = await db.$transaction(async (tx) => {
    const created = await tx.withdrawalRequest.create({
      data: {
        code,
        orderId: matches ? order!.id : null,
        orderNumber: number ?? input.orderNumber.trim().slice(0, 30),
        name: matches ? `${order!.firstName} ${order!.lastName}` : '',
        email: email ?? (matches ? order!.email : ''),
        phone: phone ?? (matches ? order!.phone : null),
        dni: matches ? order!.dni : null,
        reason: input.reason.trim().slice(0, 1000) || null,
      },
    })
    if (matches) {
      await addOrderEvent(tx, order!.id, { type: 'CUSTOMER', label: email ?? phone }, { type: 'withdrawal', message: `Botón de arrepentimiento: código ${code}`, data: { withdrawalId: created.id } })
    }
    const to = created.email
    if (to) {
      await enqueueEmail(
        tx,
        { template: 'withdrawal_code', to, vars: { nombre: matches ? order!.firstName : '', numero: created.orderNumber, codigo: code }, ctaPath: matches ? orderPath(order!) : null, dedupeKey: `withdrawal:${created.id}`, related: { type: 'withdrawal', id: created.id } },
        s,
      )
      await tx.withdrawalRequest.update({ where: { id: created.id }, data: { emailSentAt: new Date() } })
    }
    if (s['company.email']) {
      await enqueueEmail(
        tx,
        {
          template: 'withdrawal_team',
          to: s['company.email'],
          vars: { nombre: created.name || 'Una clienta', numero: created.orderNumber, codigo: code, contacto: [created.email, created.phone].filter(Boolean).join(' · '), motivo: created.reason ?? 'Sin motivo (no hace falta dar uno).' },
          ctaPath: null,
          dedupeKey: `withdrawal:${created.id}:team`,
          related: { type: 'withdrawal', id: created.id },
        },
        s,
      )
    }
    return created
  })
  return { ok: true as const, code: request.code, emailed: !!request.email }
}

// ---------------------------------------------------------- order lookup ----

/** CU-20: number and the email of the purchase; or a signed link from an email. */
export async function findOrderForCustomer(db: PrismaClient, input: { number: string; email?: string | null; token?: string | null }) {
  const number = normalizeOrderNumber(input.number)
  if (!number) return null
  const order = await db.order.findUnique({
    where: { number },
    include: { items: true, shipment: true, payments: { orderBy: { createdAt: 'desc' } }, refunds: true },
  })
  if (!order || order.anonymizedAt) return null
  const byToken = verify('order', order.id, input.token)
  const byEmail = !!input.email && order.email === input.email.trim().toLowerCase()
  return byToken || byEmail ? order : null
}

// ---------------------------------------------------------- back in stock ----

export async function requestBackInStock(db: PrismaClient, sku: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase()
  if (!isEmail(e)) return { ok: false, error: 'Ingresá un email válido.' }
  const variant = await db.productVariant.findUnique({ where: { sku }, select: { id: true } })
  if (!variant) return { ok: false, error: 'Ese producto ya no está disponible.' }
  const pending = await db.backInStockRequest.findFirst({ where: { email: e, variantId: variant.id, notifiedAt: null } })
  if (!pending) await db.backInStockRequest.create({ data: { email: e, variantId: variant.id } })
  return { ok: true }
}

// --------------------------------------------------------------- reviews ----

export const USAGE_TIMES = ['Menos de 2 semanas', 'De 2 a 4 semanas', 'De 1 a 3 meses', 'Más de 3 meses'] as const

export const REVIEW_ERRORS = {
  rating: 'Elegí de 1 a 5 estrellas.',
  body: 'Contanos cómo te fue (al menos 20 caracteres).',
  name: 'Este dato es obligatorio.',
}

/** The lines of an order she can review: delivered, not fully refunded, not reviewed yet. Verified by the signed link or her session. */
export async function reviewableLines(db: PrismaClient, orderNumber: string, access: { token?: string | null; customerId?: string | null }) {
  const number = normalizeOrderNumber(orderNumber)
  if (!number) return null
  const order = await db.order.findUnique({ where: { number }, include: { items: { include: { reviews: { select: { id: true } } } } } })
  if (!order || order.anonymizedAt) return null
  const allowed = verify('review', order.id, access.token) || (!!access.customerId && order.customerId === access.customerId)
  if (!allowed || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status) || !order.deliveredAt) return null
  return { order, lines: order.items.filter((i) => i.productId && i.refundedQuantity < i.quantity && !i.reviews.length) }
}

/** "Ana P." from the order: first name and initial only. */
export const authorName = (first: string, last: string) => `${first.trim()}${last.trim() ? ` ${last.trim()[0]!.toUpperCase()}.` : ''}`

export async function submitReview(
  db: PrismaClient,
  orderNumber: string,
  access: { token?: string | null; customerId?: string | null },
  input: { orderItemId: string; rating: number; title: string; body: string; usageTime: string },
): Promise<{ ok: true } | { ok: false; errors: Partial<Record<'rating' | 'body' | 'form', string>> }> {
  const found = await reviewableLines(db, orderNumber, access)
  const line = found?.lines.find((l) => l.id === input.orderItemId)
  if (!found || !line) return { ok: false, errors: { form: 'Este producto ya tiene tu reseña o no se puede reseñar desde este link.' } }
  const errors: Partial<Record<'rating' | 'body', string>> = {}
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = REVIEW_ERRORS.rating
  if (input.body.trim().length < 20) errors.body = REVIEW_ERRORS.body
  if (Object.keys(errors).length) return { ok: false, errors }
  await db.review.create({
    data: {
      productId: line.productId!,
      orderItemId: line.id,
      customerId: found.order.customerId,
      authorName: authorName(found.order.firstName, found.order.lastName),
      rating: input.rating,
      title: input.title.trim().slice(0, 120) || null,
      body: input.body.trim().slice(0, 3000),
      usageTime: (USAGE_TIMES as readonly string[]).includes(input.usageTime) ? input.usageTime : null,
    },
  })
  return { ok: true }
}

/** PDP-07, F-06, F-22: approved reviews, and whether there are enough to show. */
export async function productReviews(db: PrismaClient, productId: string, minimum: number) {
  const reviews = await db.review.findMany({ where: { productId, status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 50 })
  const count = await db.review.count({ where: { productId, status: 'APPROVED' } })
  const agg = await db.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true } })
  return { show: count >= Math.max(1, minimum), count, average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, reviews }
}
