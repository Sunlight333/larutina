// The ambassador programme (EMB-01, EMB-02, NAV-10): applications, approval
// with a code, her link (?ref=CODE and /r/CODE), visits, and the code as a
// discount code for her clients (EB-C07).
import type { Prisma, PrismaClient } from '@prisma/client'
import { isEmail, normalizeCuit, normalizePhone } from '@/lib/argentina'
import type { CodeDiscount } from '@/lib/commerce/pricing'
import { enqueueEmail } from '@/server/email'
import { loadSettings, type SettingValues } from '@/server/settings'

type Db = PrismaClient | Prisma.TransactionClient

export const PROFESSIONS = ['Cosmetóloga', 'Esteticista', 'Dermatóloga', 'Otra'] as const // EB-09
export const WORKPLACES = ['Consultorio', 'Centro', 'A domicilio', 'Online'] as const // EB-09

export const APPLY_ERRORS = {
  required: 'Este dato es obligatorio.',
  email: 'Ingresá un email válido.',
  phone: 'Ingresá un teléfono con código de área.',
  privacy: 'Para enviarla, aceptá la Política de privacidad.',
  duplicate: 'Ya recibimos una postulación con ese email.',
}

export type ApplyInput = {
  name: string
  email: string
  phone: string
  profession: string
  license: string
  licenseFile: string | null
  city: string
  workplaces: string[]
  social: string
  motivation: string
  privacyAccepted: boolean
}

/** EB-09, EB-10, EMB-01: received with its attachment, pending until approved. */
export async function applyAsAmbassador(db: PrismaClient, input: ApplyInput) {
  const errors: Partial<Record<keyof ApplyInput, string>> = {}
  const email = input.email.trim().toLowerCase()
  const parts = input.name.trim().split(/\s+/)
  if (parts.length < 2) errors.name = 'Escribí nombre y apellido.'
  if (!isEmail(email)) errors.email = APPLY_ERRORS.email
  if (!input.phone.trim()) errors.phone = APPLY_ERRORS.required
  else if (!normalizePhone(input.phone)) errors.phone = APPLY_ERRORS.phone
  if (!(PROFESSIONS as readonly string[]).includes(input.profession)) errors.profession = APPLY_ERRORS.required
  if (!input.city.trim()) errors.city = APPLY_ERRORS.required
  if (!input.workplaces.length) errors.workplaces = APPLY_ERRORS.required
  if (!input.motivation.trim()) errors.motivation = APPLY_ERRORS.required
  if (!input.privacyAccepted) errors.privacyAccepted = APPLY_ERRORS.privacy
  if (Object.keys(errors).length) return { ok: false as const, errors }
  if (await db.ambassador.count({ where: { email, status: { in: ['PENDING', 'APPROVED'] } } })) return { ok: false as const, errors: { email: APPLY_ERRORS.duplicate } }

  const s = await loadSettings(db)
  const privacy = await db.legalDocument.findUnique({ where: { code: 'privacidad' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
  const customer = await db.customer.findUnique({ where: { email }, select: { id: true, ambassador: { select: { id: true } } } })
  const a = await db.$transaction(async (tx) => {
    const created = await tx.ambassador.create({
      data: {
        customerId: customer && !customer.ambassador ? customer.id : null,
        firstName: parts.slice(0, -1).join(' ').slice(0, 60),
        lastName: parts.at(-1)!.slice(0, 60),
        email,
        phone: normalizePhone(input.phone)!,
        profession: input.profession,
        license: input.license.trim() || null,
        licenseFile: input.licenseFile,
        city: input.city.trim().slice(0, 80),
        workplaces: input.workplaces.filter((w) => (WORKPLACES as readonly string[]).includes(w)),
        social: input.social.trim().slice(0, 200) || null,
        motivation: input.motivation.trim().slice(0, 2000),
        privacyVersion: privacy?.versions[0]?.version ?? null,
      },
    })
    const days = s['ambassadors.reviewDays']
    await enqueueEmail(tx, { template: 'ambassador_received', to: email, vars: { nombre: created.firstName, plazo: days > 0 ? ` en ${days} días hábiles` : '' }, ctaPath: '/embajadoras', dedupeKey: `ambassador:${created.id}:received`, related: { type: 'ambassador', id: created.id } }, s)
    return created
  })
  return { ok: true as const, id: a.id }
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** A code from her name, unique among ambassadors and coupons: ANAPEREZ, ANAPEREZ2, ... */
export async function suggestCode(db: Db, first: string, last: string) {
  const base = (plain(first).slice(0, 8) + plain(last).slice(0, 8)).slice(0, 14) || 'EMBAJADORA'
  for (let n = 1; n < 100; n++) {
    const code = n === 1 ? base : `${base}${n}`
    const taken = (await db.ambassador.count({ where: { code } })) + (await db.coupon.count({ where: { code } }))
    if (!taken) return code
  }
  return `${base}${Date.now() % 10000}`
}

export async function approveAmbassador(db: PrismaClient, id: string, input: { code: string; commissionPct: number | null; customerDiscountPct: number | null; cuit: string; payoutAccount: string }) {
  const code = plain(input.code)
  if (code.length < 3) return { ok: false as const, error: 'El código necesita al menos 3 letras o números.' }
  if (await db.ambassador.count({ where: { code, id: { not: id } } })) return { ok: false as const, error: 'Ese código ya lo tiene otra embajadora.' }
  if (await db.coupon.count({ where: { code } })) return { ok: false as const, error: 'Ese código ya es un cupón.' }
  const cuit = input.cuit.trim() ? normalizeCuit(input.cuit) : null
  if (input.cuit.trim() && !cuit) return { ok: false as const, error: 'Revisá el CUIT.' }
  const s = await loadSettings(db)
  await db.$transaction(async (tx) => {
    const before = await tx.ambassador.findUniqueOrThrow({ where: { id } })
    const a = await tx.ambassador.update({
      where: { id },
      data: { status: 'APPROVED', code, commissionPct: input.commissionPct, customerDiscountPct: input.customerDiscountPct, cuit, payoutAccount: input.payoutAccount.trim() || null, approvedAt: before.approvedAt ?? new Date(), rejectReason: null },
    })
    if (before.status !== 'APPROVED') {
      await enqueueEmail(tx, { template: 'ambassador_approved', to: a.email, vars: { nombre: a.firstName }, ctaPath: '/embajadoras/panel', dedupeKey: `ambassador:${a.id}:approved:${(a.approvedAt ?? new Date()).getTime()}`, related: { type: 'ambassador', id: a.id } }, s)
    }
  })
  return { ok: true as const, code }
}

export async function rejectAmbassador(db: PrismaClient, id: string, reason: string) {
  const s = await loadSettings(db)
  await db.$transaction(async (tx) => {
    const a = await tx.ambassador.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason.trim() || null } })
    // EM-17: the reason, if any, is always about the programme, never about the person.
    await enqueueEmail(tx, { template: 'ambassador_rejected', to: a.email, vars: { nombre: a.firstName, motivo: reason.trim() ? `${reason.trim().replace(/\.?$/, '.')}` : '' }, dedupeKey: `ambassador:${a.id}:rejected`, related: { type: 'ambassador', id: a.id } }, s)
  })
}

/** EB-C10: she leaves, or is removed. What is approved, and what is pending and gets approved, is still paid. */
export async function ambassadorLeaves(db: PrismaClient, id: string) {
  await db.ambassador.update({ where: { id }, data: { status: 'LEFT', leftAt: new Date() } })
}

export async function approvedByCode(db: Db, raw: string | null | undefined) {
  const code = raw ? plain(raw) : ''
  if (!code) return null
  return db.ambassador.findFirst({ where: { code, status: 'APPROVED' } })
}

/** EB-C07: what her code gives the customer (her own %, else the general one). Null when it gives nothing: it still records the commission. */
export function ambassadorDiscount(a: { customerDiscountPct: number | null }, s: SettingValues): CodeDiscount | null {
  const pct = a.customerDiscountPct ?? s['ambassadors.customerDiscountPct']
  return pct > 0 ? { kind: 'PERCENT', value: pct, combinesWithTransfer: true } : null
}

/** EB-14: one visit per device per day. */
export async function recordVisit(db: Db, ambassadorId: string, visitor: string, path: string) {
  const since = new Date(Date.now() - 24 * 3_600_000)
  if (await db.referralVisit.count({ where: { ambassadorId, visitor, createdAt: { gte: since } } })) return
  await db.referralVisit.create({ data: { ambassadorId, visitor, path: path.slice(0, 200) } })
}

/** G-10, spec §10.2: the link saved on her account at signup or login, unless a newer one is already there. */
export async function linkAccountToAmbassador(db: Db, customerId: string, ambassadorId: string, at: Date) {
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { referredAt: true, ambassador: { select: { id: true } } } })
  if (!c || c.ambassador?.id === ambassadorId) return
  if (c.referredAt && c.referredAt > at) return
  await db.customer.update({ where: { id: customerId }, data: { referredById: ambassadorId, referredAt: at } })
}
