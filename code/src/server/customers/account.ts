// Customer accounts (CTA-01..03, IR-12, PDP-09), with the content file's
// texts (CU-01..CU-17). Database only, so it is tested without a request; the
// cookie side is in ./session.ts.
import { createHash, randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { isEmail } from '@/lib/argentina'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { enqueueEmail } from '@/server/email'
import { loadSettings } from '@/server/settings'

export const ACCOUNT_ERRORS = {
  login: 'El email o la contraseña no coinciden.', // CU-02
  email: 'Ingresá un email válido.',
  required: 'Este dato es obligatorio.',
  password: 'La contraseña necesita al menos 8 caracteres.', // CU-03
  passwordLong: 'La contraseña es demasiado larga.',
  repeat: 'Las contraseñas no coinciden.',
  terms: 'Para crear la cuenta, aceptá los Términos y la Política de privacidad.',
  exists: 'Ya hay una cuenta con ese email. Ingresá con tu contraseña.',
  linkExpired: 'Este link ya venció. Pedí uno nuevo.', // CU-05
  openOrders: 'Tenés un pedido en curso. Cuando lo recibas, vas a poder eliminar tu cuenta.',
}

/** CU-04: the same answer whether the account exists or not. */
export const RESET_SENT = 'Si hay una cuenta con ese email, te llega el link en unos minutos.'
export const REGISTER_NEWSLETTER_CONSENT = 'Quiero recibir el newsletter'

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return ACCOUNT_ERRORS.password
  if (password.length > 200) return ACCOUNT_ERRORS.passwordLong
  return null
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

type Fields<K extends string> = Partial<Record<K, string>>

export async function registerCustomer(
  db: PrismaClient,
  input: { name: string; email: string; password: string; acceptedTerms: boolean; newsletter: boolean },
): Promise<{ ok: true; customerId: string } | { ok: false; errors: Fields<'name' | 'email' | 'password' | 'terms'> }> {
  const errors: Fields<'name' | 'email' | 'password' | 'terms'> = {}
  const email = normalizeEmail(input.email)
  if (!input.name.trim()) errors.name = ACCOUNT_ERRORS.required
  if (!isEmail(email)) errors.email = ACCOUNT_ERRORS.email
  const pw = passwordProblem(input.password)
  if (pw) errors.password = pw
  if (!input.acceptedTerms) errors.terms = ACCOUNT_ERRORS.terms
  if (Object.keys(errors).length) return { ok: false, errors }

  const existing = await db.customer.findUnique({ where: { email } })
  if (existing?.passwordHash) return { ok: false, errors: { email: ACCOUNT_ERRORS.exists } }
  const passwordHash = await hashPassword(input.password)
  const s = await loadSettings(db)
  const customer = await db.$transaction(async (tx) => {
    const c = existing
      ? await tx.customer.update({ where: { id: existing.id }, data: { passwordHash, firstName: input.name.trim().slice(0, 60), newsletter: input.newsletter } })
      : await tx.customer.create({ data: { email, passwordHash, firstName: input.name.trim().slice(0, 60), newsletter: input.newsletter } })
    if (input.newsletter) await tx.newsletterSubscriber.upsert({ where: { email }, create: { email, consentText: REGISTER_NEWSLETTER_CONSENT, source: 'registro' }, update: { unsubscribedAt: null } })
    await enqueueEmail(tx, { template: 'welcome', to: email, vars: { nombre: c.firstName ?? '' }, ctaPath: '/cuenta', dedupeKey: `customer:${c.id}:welcome`, related: { type: 'customer', id: c.id } }, s)
    return c
  })
  return { ok: true, customerId: customer.id }
}

/**
 * IR-12, CF-04: a guest creates her account from the confirmation page with
 * only a password. The order she just placed (and only that one: emails are
 * not verified, so other orders with the same email are not attached) joins it.
 */
export async function accountFromOrder(db: PrismaClient, orderId: string, password: string): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const pw = passwordProblem(password)
  if (pw) return { ok: false, error: pw }
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.anonymizedAt) return { ok: false, error: ACCOUNT_ERRORS.linkExpired }
  const existing = await db.customer.findUnique({ where: { email: order.email } })
  if (existing?.passwordHash) return { ok: false, error: ACCOUNT_ERRORS.exists }
  const passwordHash = await hashPassword(password)
  const s = await loadSettings(db)
  const customer = await db.$transaction(async (tx) => {
    const data = { passwordHash, firstName: order.firstName, lastName: order.lastName, dni: order.dni, phone: order.phone, newsletter: order.newsletterOptIn }
    const c = existing ? await tx.customer.update({ where: { id: existing.id }, data }) : await tx.customer.create({ data: { email: order.email, ...data } })
    await tx.order.update({ where: { id: order.id }, data: { customerId: c.id } })
    const a = order.shippingAddress as { street: string; unit: string | null; postcode: string; locality: string; province: string; notes: string | null }
    if (!(await tx.address.count({ where: { customerId: c.id } }))) {
      await tx.address.create({ data: { customerId: c.id, firstName: order.firstName, lastName: order.lastName, dni: order.dni, phone: order.phone, street: a.street, unit: a.unit, postcode: a.postcode, locality: a.locality, province: a.province, notes: a.notes, isDefault: true } })
    }
    await enqueueEmail(tx, { template: 'welcome', to: c.email, vars: { nombre: c.firstName ?? '' }, ctaPath: '/cuenta', dedupeKey: `customer:${c.id}:welcome`, related: { type: 'customer', id: c.id } }, s)
    return c
  })
  return { ok: true, customerId: customer.id }
}

export async function authenticate(db: PrismaClient, email: string, password: string) {
  const customer = await db.customer.findUnique({ where: { email: normalizeEmail(email) } })
  if (!customer?.passwordHash) {
    // Same work either way, so timing does not tell whether the account exists.
    await hashPassword(password)
    return null
  }
  if (!(await verifyPassword(password, customer.passwordHash))) return null
  await db.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } })
  return customer
}

const RESET_MS = 60 * 60 * 1000 // EM-11: "El link vale por 1 hora."

export async function requestPasswordReset(db: PrismaClient, email: string) {
  const customer = await db.customer.findUnique({ where: { email: normalizeEmail(email) } })
  if (!customer?.passwordHash) return
  const token = randomBytes(32).toString('base64url')
  await db.$transaction(async (tx) => {
    await tx.customerToken.updateMany({ where: { customerId: customer.id, purpose: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } })
    await tx.customerToken.create({ data: { id: hashToken(token), customerId: customer.id, purpose: 'RESET_PASSWORD', expiresAt: new Date(Date.now() + RESET_MS) } })
    await enqueueEmail(tx, { template: 'password_reset', to: customer.email, vars: {}, ctaPath: `/cuenta/nueva-contrasena?t=${token}`, related: { type: 'customer', id: customer.id } })
  })
}

/** CU-05: whether a reset link can still be used, so an expired one says so before she types. */
export async function resetLinkValid(db: PrismaClient, token: string): Promise<boolean> {
  if (!token || token.length > 100) return false
  const row = await db.customerToken.findUnique({ where: { id: hashToken(token) } })
  return !!row && !row.usedAt && row.expiresAt > new Date() && row.purpose === 'RESET_PASSWORD'
}

export async function resetPassword(db: PrismaClient, token: string, password: string, repeat: string): Promise<{ ok: true; customerId: string } | { ok: false; error: string; field?: 'password' | 'repeat' }> {
  const row = token ? await db.customerToken.findUnique({ where: { id: hashToken(token) } }) : null
  if (!row || row.usedAt || row.expiresAt < new Date() || row.purpose !== 'RESET_PASSWORD') return { ok: false, error: ACCOUNT_ERRORS.linkExpired }
  const pw = passwordProblem(password)
  if (pw) return { ok: false, error: pw, field: 'password' }
  if (password !== repeat) return { ok: false, error: ACCOUNT_ERRORS.repeat, field: 'repeat' }
  const passwordHash = await hashPassword(password)
  await db.$transaction([
    db.customerToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.customer.update({ where: { id: row.customerId }, data: { passwordHash } }),
    // Every other session ends with the old password.
    db.customerSession.deleteMany({ where: { customerId: row.customerId } }),
  ])
  return { ok: true, customerId: row.customerId }
}

export async function changePassword(db: PrismaClient, customerId: string, current: string, next: string, repeat: string): Promise<{ ok: true } | { ok: false; field: 'current' | 'password' | 'repeat'; error: string }> {
  const c = await db.customer.findUniqueOrThrow({ where: { id: customerId } })
  if (!c.passwordHash || !(await verifyPassword(current, c.passwordHash))) return { ok: false, field: 'current', error: 'La contraseña actual no coincide.' }
  const pw = passwordProblem(next)
  if (pw) return { ok: false, field: 'password', error: pw }
  if (next !== repeat) return { ok: false, field: 'repeat', error: ACCOUNT_ERRORS.repeat }
  await db.customer.update({ where: { id: customerId }, data: { passwordHash: await hashPassword(next) } })
  return { ok: true }
}

export async function setNewsletter(db: PrismaClient, customerId: string, on: boolean) {
  const c = await db.customer.update({ where: { id: customerId }, data: { newsletter: on } })
  if (on) await db.newsletterSubscriber.upsert({ where: { email: c.email }, create: { email: c.email, consentText: REGISTER_NEWSLETTER_CONSENT, source: 'cuenta' }, update: { unsubscribedAt: null } })
  else await db.newsletterSubscriber.updateMany({ where: { email: c.email, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } })
}

// ------------------------------------------------------------ favourites ----

export async function toggleFavorite(db: PrismaClient, customerId: string, productId: string): Promise<boolean> {
  const key = { customerId_productId: { customerId, productId } }
  if (await db.favorite.findUnique({ where: key })) {
    await db.favorite.delete({ where: key })
    return false
  }
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) return false
  await db.favorite.create({ data: { customerId, productId } })
  return true
}

// --------------------------------------------------------------- delete ----

const OPEN: Prisma.EnumOrderStatusFilter = { in: ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED'] }

/**
 * CTA-03, CU-17: profile, diagnoses, routine and favourites go; orders stay,
 * reduced to what tax law requires (number, items, amounts, name and DNI for
 * the invoice), without email, phone or street address. An order still on its
 * way keeps her data until it arrives, so deletion waits for it.
 */
export async function deleteAccount(db: PrismaClient, customerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await db.customer.findUnique({ where: { id: customerId } })
  if (!customer) return { ok: true }
  if (await db.order.count({ where: { customerId, status: OPEN } })) return { ok: false, error: ACCOUNT_ERRORS.openOrders }
  const s = await loadSettings(db)
  await db.$transaction(async (tx) => {
    await enqueueEmail(tx, { template: 'account_deleted', to: customer.email, vars: { nombre: customer.firstName ?? '' }, related: { type: 'customer', id: customer.id } }, s)
    const orders = await tx.order.findMany({ where: { customerId }, select: { id: true, shippingAddress: true } })
    for (const o of orders) {
      const a = o.shippingAddress as { postcode?: string; locality?: string; province?: string }
      await tx.order.update({
        where: { id: o.id },
        data: {
          customerId: null,
          email: `eliminada+${o.id}@cuenta.invalid`,
          phone: '',
          shippingAddress: { street: '', unit: null, postcode: a.postcode ?? '', locality: a.locality ?? '', province: a.province ?? '', notes: null },
          anonymizedAt: new Date(),
        },
      })
    }
    await tx.newsletterSubscriber.updateMany({ where: { email: customer.email, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } })
    await tx.backInStockRequest.deleteMany({ where: { email: customer.email } })
    await tx.cart.deleteMany({ where: { customerId } })
    // Sessions, tokens, addresses and favourites go with the row (cascade).
    await tx.customer.delete({ where: { id: customerId } })
  })
  return { ok: true }
}
