// The commerce screens of the panel: coupons (CMP-08), boxes and fallback
// rates (ENV-03, ENV-04), review moderation (PDP-07), withdrawals (PED-04),
// stock adjustments (PED-02 ledger) and email texts (EML-01). Every change is
// in the change log (ADM-03).
import { z } from 'zod'
import type { CouponKind, PrismaClient, ReviewStatus } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import { isProvince } from '@/lib/argentina'
import { adjustStock } from '@/server/commerce/stock'
import { normalizeCode } from '@/server/commerce/coupons'
import { emailTemplateDef } from '@/server/email/templates'

// --------------------------------------------------------------- coupons ----

export const couponSchema = z
  .object({
    code: z.string().trim().min(3, 'Al menos 3 caracteres.').max(30).regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, - y _.'),
    kind: z.enum(['PERCENT', 'AMOUNT']),
    value: z.number({ message: 'Este dato es obligatorio.' }).int().positive('Tiene que ser mayor que cero.'),
    description: z.string().trim().max(200).nullable(),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    minSubtotalCents: z.number().int().positive().nullable(),
    maxUses: z.number().int().positive().nullable(),
    firstPurchaseOnly: z.boolean(),
    combinesWithTransfer: z.boolean(),
    active: z.boolean(),
  })
  .refine((c) => c.kind !== 'PERCENT' || c.value <= 100, { path: ['value'], message: 'Un porcentaje va de 1 a 100.' })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt < c.endsAt, { path: ['endsAt'], message: 'Tiene que ser después del inicio.' })
export type CouponInput = z.infer<typeof couponSchema>

export async function saveCoupon(db: PrismaClient, actor: Actor, id: string | null, input: CouponInput) {
  const data = { ...input, code: normalizeCode(input.code), kind: input.kind as CouponKind }
  const clash = await db.coupon.findFirst({ where: { code: data.code, ...(id ? { id: { not: id } } : {}) } })
  if (clash) return { ok: false as const, error: 'Ya hay un cupón con ese código.' }
  return db.$transaction(async (tx) => {
    if (!id) {
      const c = await tx.coupon.create({ data })
      await audit(tx, actor, { action: 'create', entityType: 'Coupon', entityId: c.id, label: c.code, after: data })
      return { ok: true as const, id: c.id }
    }
    const before = await tx.coupon.findUniqueOrThrow({ where: { id } })
    const c = await tx.coupon.update({ where: { id }, data })
    const diff = changedFields(before as unknown as Record<string, unknown>, data)
    if (diff.changed) await audit(tx, actor, { action: 'update', entityType: 'Coupon', entityId: id, label: c.code, before: diff.before, after: diff.after })
    return { ok: true as const, id }
  })
}

export async function deleteCoupon(db: PrismaClient, actor: Actor, id: string) {
  const c = await db.coupon.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  await audit(db, actor, { action: 'delete', entityType: 'Coupon', entityId: id, label: c.code })
}

// ------------------------------------------------------- boxes and rates ----

export const boxSchema = z.object({
  code: z.string().trim().min(1, 'Este dato es obligatorio.').max(30).regex(/^[a-z0-9-]+$/, 'Minúsculas, números y guiones.'),
  name: z.string().trim().min(1, 'Este dato es obligatorio.').max(60),
  heightCm: z.number({ message: 'Este dato es obligatorio.' }).positive('Mayor que cero.'),
  widthCm: z.number({ message: 'Este dato es obligatorio.' }).positive('Mayor que cero.'),
  lengthCm: z.number({ message: 'Este dato es obligatorio.' }).positive('Mayor que cero.'),
  emptyWeightGrams: z.number().int().min(0),
  maxWeightGrams: z.number().int().positive().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
})
export type BoxInput = z.infer<typeof boxSchema>

export async function saveBox(db: PrismaClient, actor: Actor, id: string | null, input: BoxInput) {
  return db.$transaction(async (tx) => {
    if (input.isDefault) await tx.shippingBox.updateMany({ where: { isDefault: true, ...(id ? { id: { not: id } } : {}) }, data: { isDefault: false } })
    const clash = await tx.shippingBox.findFirst({ where: { code: input.code, ...(id ? { id: { not: id } } : {}) } })
    if (clash) return { ok: false as const, error: 'Ya hay una caja con ese código.' }
    const box = id ? await tx.shippingBox.update({ where: { id }, data: input }) : await tx.shippingBox.create({ data: input })
    await audit(tx, actor, { action: id ? 'update' : 'create', entityType: 'ShippingBox', entityId: box.id, label: box.name, after: input })
    return { ok: true as const, id: box.id }
  })
}

export const rateSchema = z.object({
  zone: z.string().trim().min(1, 'Este dato es obligatorio.').max(60),
  provinces: z.array(z.string()).min(1, 'Elegí al menos una provincia.').refine((p) => p.every(isProvince), 'Provincia desconocida.'),
  carrier: z.string().trim().min(1, 'Este dato es obligatorio.').max(60),
  priceCents: z.number({ message: 'Este dato es obligatorio.' }).int().min(0),
  minDays: z.number({ message: 'Este dato es obligatorio.' }).int().min(0),
  maxDays: z.number({ message: 'Este dato es obligatorio.' }).int().min(0),
  position: z.number().int().min(0),
  active: z.boolean(),
}).refine((r) => r.maxDays >= r.minDays, { path: ['maxDays'], message: 'No puede ser menor que el mínimo.' })
export type RateInput = z.infer<typeof rateSchema>

export async function saveRate(db: PrismaClient, actor: Actor, id: string | null, input: RateInput) {
  return db.$transaction(async (tx) => {
    const rate = id ? await tx.shippingRate.update({ where: { id }, data: input }) : await tx.shippingRate.create({ data: input })
    await audit(tx, actor, { action: id ? 'update' : 'create', entityType: 'ShippingRate', entityId: rate.id, label: `${rate.zone} · ${rate.carrier}`, after: input })
    return { ok: true as const, id: rate.id }
  })
}

export async function deleteRate(db: PrismaClient, actor: Actor, id: string) {
  const r = await db.shippingRate.delete({ where: { id } })
  await audit(db, actor, { action: 'delete', entityType: 'ShippingRate', entityId: id, label: `${r.zone} · ${r.carrier}` })
}

export async function deleteBox(db: PrismaClient, actor: Actor, id: string) {
  const b = await db.shippingBox.delete({ where: { id } })
  await audit(db, actor, { action: 'delete', entityType: 'ShippingBox', entityId: id, label: b.name })
}

// --------------------------------------------------------------- reviews ----

export async function moderateReview(db: PrismaClient, actor: { id: string; email: string }, id: string, status: ReviewStatus) {
  return db.$transaction(async (tx) => {
    const r = await tx.review.update({ where: { id }, data: { status, moderatedBy: actor.email, moderatedAt: new Date() }, include: { product: { select: { name: true } } } })
    await audit(tx, actor, { action: status === 'APPROVED' ? 'approve' : 'reject', entityType: 'Review', entityId: id, label: `${r.authorName} sobre ${r.product.name}` })
    return r
  })
}

// ------------------------------------------------------------ withdrawals ----

export const WITHDRAWAL_STATUS = { received: 'Recibido', in_progress: 'Coordinando el retiro', closed: 'Cerrado' } as const

export async function updateWithdrawal(db: PrismaClient, actor: Actor, id: string, input: { status: keyof typeof WITHDRAWAL_STATUS; note: string }) {
  const before = await db.withdrawalRequest.findUniqueOrThrow({ where: { id } })
  const after = { status: input.status, note: input.note.trim() || null }
  const diff = changedFields(before as unknown as Record<string, unknown>, after)
  if (!diff.changed) return false
  await db.$transaction(async (tx) => {
    await tx.withdrawalRequest.update({ where: { id }, data: after })
    await audit(tx, actor, { action: 'update', entityType: 'WithdrawalRequest', entityId: id, label: before.code, before: diff.before, after: diff.after })
  })
  return true
}

// ----------------------------------------------------------------- stock ----

export async function adjustVariantStock(db: PrismaClient, actor: { id: string; email: string }, sku: string, delta: number, note: string) {
  const variant = await db.productVariant.findUnique({ where: { sku }, include: { product: { select: { name: true } } } })
  if (!variant) return { ok: false as const, error: 'No hay una variante con ese SKU.' }
  if (!Number.isInteger(delta) || delta === 0) return { ok: false as const, error: 'Escribí cuánto sumar o restar (por ejemplo 12 o -2).' }
  if (!note.trim()) return { ok: false as const, error: 'Escribí el motivo (llegó mercadería, conteo, rotura...).' }
  try {
    const stock = await db.$transaction(async (tx) => {
      const after = await adjustStock(tx, variant.id, delta, note.trim(), actor.email)
      await audit(tx, actor, { action: 'adjust-stock', entityType: 'ProductVariant', entityId: variant.id, label: `${variant.product.name} · ${sku}`, before: { stock: variant.stock }, after: { stock: after, note: note.trim() } })
      return after
    })
    return { ok: true as const, stock }
  } catch (e) {
    return { ok: false as const, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------- emails ----

export async function saveEmailTemplate(db: PrismaClient, actor: { id: string; email: string }, key: string, input: { subject: string; preheader: string; body: string; ctaLabel: string }) {
  const def = emailTemplateDef(key)
  if (!def) throw new Error('Email desconocido')
  const data = { subject: input.subject.trim(), preheader: input.preheader.trim(), body: input.body.trim(), ctaLabel: input.ctaLabel.trim() }
  await db.$transaction(async (tx) => {
    const before = await tx.emailTemplate.findUnique({ where: { key } })
    await tx.emailTemplate.upsert({ where: { key }, create: { key, ...data, updatedBy: actor.email }, update: { ...data, updatedBy: actor.email } })
    await audit(tx, actor, { action: 'update', entityType: 'EmailTemplate', entityId: key, label: def.label, before: before ?? { subject: def.subject, preheader: def.preheader, body: def.body, ctaLabel: def.ctaLabel }, after: data })
  })
}

export async function restoreEmailTemplate(db: PrismaClient, actor: { id: string; email: string }, key: string) {
  const def = emailTemplateDef(key)
  if (!def) throw new Error('Email desconocido')
  await db.$transaction(async (tx) => {
    await tx.emailTemplate.deleteMany({ where: { key } })
    await audit(tx, actor, { action: 'restore', entityType: 'EmailTemplate', entityId: key, label: def.label })
  })
}
