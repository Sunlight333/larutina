// Accounts and after-sale against PostgreSQL:
//   CTA-01 register, log in, recover the password; guest checkout stays possible.
//   CTA-03 after deleting the account, no profile, favourites or open cart; orders without personal data beyond the invoice.
//   IR-12  a guest creates the account from the confirmation with only a password.
//   PED-04 the withdrawal form: code by email at once, recorded on the order, team notified.
//   PED-05 order status with number and email, without an account.
//   NAV-07 the back-in-stock notice goes out once, when stock passes from 0 to more.
//   PDP-07 only verified buyers review; nothing shows below the minimum.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const acc = await import('../../src/server/customers/account')
const after = await import('../../src/server/commerce/aftersale')
const { addToCart, ensureCart } = await import('../../src/server/commerce/cart')
const { placeOrder } = await import('../../src/server/commerce/checkout')
const { confirmTransfer } = await import('../../src/server/commerce/payments')
const { moveOrder, SYSTEM } = await import('../../src/server/commerce/orders')
const { sendBackInStock } = await import('../../src/server/commerce/sweep')
const { optionKey } = await import('../../src/server/commerce/shipping/quote')
const { saveSettings, loadSettings } = await import('../../src/server/settings')
const { emptyContact } = await import('../../src/lib/commerce/checkout-form')
const { sign } = await import('../../src/server/secret')

let db: PrismaClient
const admin = { id: 'a1', email: 'equipo@larutina.test' }

async function buy(email: string) {
  const { cartId, newToken } = await ensureCart(db, null, null)
  await addToCart(db, cartId, { sku: 'MA-GEL-150', quantity: 1 })
  const r = await placeOrder(
    db,
    {
      cartToken: newToken,
      customerId: null,
      contact: { ...emptyContact(), email, firstName: 'Lucía', lastName: 'Gómez', dni: '30123456', phone: '011 15 5039-0302', street: 'Calle 1', postcode: '1414', locality: 'CABA', province: 'C' },
      shippingKey: optionKey({ provider: 'tabla', carrier: 'Correo Argentino', service: 'AMBA' }),
      method: 'transfer',
      acceptedTerms: true,
    },
    { payments: null, shipping: null },
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  return r.orderId
}

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, shipping_rates, shipping_boxes, email_messages, payment_notifications, newsletter_subscribers, withdrawal_requests, back_in_stock_requests CASCADE`,
  )
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(baseCatalog()) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 20 } })
  await saveSettings(db, { 'company.bankHolder': 'Larutina S.A.', 'company.bankAlias': 'larutina.pagos', 'company.email': 'hola@larutina.test' })
  await db.shippingRate.create({ data: { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Correo Argentino', priceCents: 500_000, minDays: 2, maxDays: 4 } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('accounts (CTA-01)', () => {
  it('registers once, logs in, and says the same thing for a wrong email or password', async () => {
    const r = await acc.registerCustomer(db, { name: 'Ana', email: 'Ana@Mail.com', password: 'clave-segura', acceptedTerms: true, newsletter: true })
    expect(r.ok).toBe(true)
    const again = await acc.registerCustomer(db, { name: 'Ana', email: 'ana@mail.com', password: 'otra-clave-1', acceptedTerms: true, newsletter: false })
    expect(!again.ok && again.errors.email).toBe(acc.ACCOUNT_ERRORS.exists)
    expect(await acc.authenticate(db, 'ana@mail.com', 'clave-segura')).not.toBeNull()
    expect(await acc.authenticate(db, 'ana@mail.com', 'mala')).toBeNull()
    expect(await acc.authenticate(db, 'nadie@mail.com', 'clave-segura')).toBeNull()
    expect(await db.emailMessage.count({ where: { template: 'welcome', to: 'ana@mail.com' } })).toBe(1)
    expect(await db.newsletterSubscriber.count({ where: { email: 'ana@mail.com', unsubscribedAt: null } })).toBe(1)
  })

  it('asks for 8 characters and the terms (CU-03)', async () => {
    const r = await acc.registerCustomer(db, { name: '', email: 'x', password: 'corta', acceptedTerms: false, newsletter: false })
    expect(!r.ok && r.errors).toEqual({ name: acc.ACCOUNT_ERRORS.required, email: acc.ACCOUNT_ERRORS.email, password: acc.ACCOUNT_ERRORS.password, terms: acc.ACCOUNT_ERRORS.terms })
  })

  it('recovers the password with a one-hour, one-use link', async () => {
    await acc.requestPasswordReset(db, 'ana@mail.com')
    const email = await db.emailMessage.findFirstOrThrow({ where: { template: 'password_reset', to: 'ana@mail.com' }, orderBy: { createdAt: 'desc' } })
    const token = /nueva-contrasena\?t=([\w-]+)/.exec(email.text)![1]!
    expect((await acc.resetPassword(db, token, 'nueva-clave', 'otra')).ok).toBe(false)
    expect((await acc.resetPassword(db, token, 'nueva-clave', 'nueva-clave')).ok).toBe(true)
    const reused = await acc.resetPassword(db, token, 'tercera-clave', 'tercera-clave')
    expect(!reused.ok && reused.error).toBe('Este link ya venció. Pedí uno nuevo.')
    expect(await acc.authenticate(db, 'ana@mail.com', 'nueva-clave')).not.toBeNull()
  })
})

describe('guest → account (IR-12)', () => {
  it('only the order she just placed joins the new account', async () => {
    const earlier = await buy('guest@mail.com')
    const now = await buy('guest@mail.com')
    const r = await acc.accountFromOrder(db, now, 'clave-segura')
    if (!r.ok) throw new Error(r.error)
    expect((await db.order.findUniqueOrThrow({ where: { id: now } })).customerId).toBe(r.customerId)
    expect((await db.order.findUniqueOrThrow({ where: { id: earlier } })).customerId).toBeNull()
    expect(await db.address.count({ where: { customerId: r.customerId } })).toBe(1)
  })
})

describe('account deletion (CTA-03)', () => {
  it('waits for an order on its way, then removes the profile and keeps orders without personal data', async () => {
    const r = await acc.registerCustomer(db, { name: 'Bea', email: 'bea@mail.com', password: 'clave-segura', acceptedTerms: true, newsletter: false })
    if (!r.ok) throw new Error()
    const orderId = await buy('bea@mail.com')
    await db.order.update({ where: { id: orderId }, data: { customerId: r.customerId } })
    await confirmTransfer(db, orderId, admin)
    await acc.toggleFavorite(db, r.customerId, (await db.product.findFirstOrThrow()).id)

    expect(await acc.deleteAccount(db, r.customerId)).toEqual({ ok: false, error: acc.ACCOUNT_ERRORS.openOrders })
    await db.$transaction(async (tx) => {
      await moveOrder(tx, orderId, 'SHIPPED', SYSTEM)
      await moveOrder(tx, orderId, 'DELIVERED', SYSTEM)
    })
    expect(await acc.deleteAccount(db, r.customerId)).toEqual({ ok: true })

    expect(await db.customer.count({ where: { id: r.customerId } })).toBe(0)
    expect(await db.favorite.count({ where: { customerId: r.customerId } })).toBe(0)
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(o.email).not.toContain('bea@mail.com')
    expect(o.phone).toBe('')
    expect((o.shippingAddress as { street: string }).street).toBe('')
    expect(o.dni).toBe('30123456') // invoice data stays
    expect(o.anonymizedAt).not.toBeNull()
    expect(await db.emailMessage.count({ where: { template: 'account_deleted', to: 'bea@mail.com' } })).toBe(1)
  })
})

describe('withdrawal button (PED-04)', () => {
  it('without an account: code by email at once, on the order, team notified', async () => {
    const orderId = await buy('cami@mail.com')
    const number = (await db.order.findUniqueOrThrow({ where: { id: orderId } })).number
    const r = await after.requestWithdrawal(db, { orderNumber: `#${number}`, contact: 'cami@mail.com', reason: '' })
    if (!r.ok) throw new Error()
    expect(r.code).toMatch(/^ARR-[A-Z2-9]{6}$/)
    const mail = await db.emailMessage.findFirstOrThrow({ where: { template: 'withdrawal_code', to: 'cami@mail.com' } })
    expect(mail.subject).toBe(`Recibimos tu pedido de arrepentimiento · Código ${r.code}`)
    expect(await db.emailMessage.count({ where: { template: 'withdrawal_team', to: 'hola@larutina.test' } })).toBe(1)
    expect(await db.orderEvent.count({ where: { orderId, type: 'withdrawal' } })).toBe(1)
  })

  it('is received even when the order does not match, and asks for what is missing', async () => {
    const r = await after.requestWithdrawal(db, { orderNumber: '999999', contact: '11 5039-0302', reason: 'No me sirvió' })
    expect(r.ok).toBe(true)
    const bad = await after.requestWithdrawal(db, { orderNumber: '', contact: 'nada', reason: '' })
    expect(!bad.ok && bad.errors).toEqual({ orderNumber: after.WITHDRAWAL_ERRORS.number, contact: after.WITHDRAWAL_ERRORS.contact })
  })
})

describe('order lookup without an account (PED-05)', () => {
  it('opens with the number and the email of the purchase, or a signed link, and nothing else', async () => {
    const orderId = await buy('dani@mail.com')
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(await after.findOrderForCustomer(db, { number: o.number.replace('LR-', ''), email: 'DANI@mail.com ' })).not.toBeNull()
    expect(await after.findOrderForCustomer(db, { number: o.number, email: 'otra@mail.com' })).toBeNull()
    expect(await after.findOrderForCustomer(db, { number: o.number, token: sign('order', o.id) })).not.toBeNull()
    expect(await after.findOrderForCustomer(db, { number: o.number, token: 'falso' })).toBeNull()
  })
})

describe('back in stock (NAV-07)', () => {
  it('one notice, sent when stock passes from 0 to more', async () => {
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 0 } })
    expect((await after.requestBackInStock(db, 'MA-SER-30', 'espera@mail.com')).ok).toBe(true)
    expect((await after.requestBackInStock(db, 'MA-SER-30', 'espera@mail.com')).ok).toBe(true) // no duplicate
    const s = await loadSettings(db)
    expect(await sendBackInStock(db, s)).toBe(0)
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 4 } })
    expect(await sendBackInStock(db, s)).toBe(1)
    expect(await sendBackInStock(db, s)).toBe(0)
    const mail = await db.emailMessage.findFirstOrThrow({ where: { template: 'back_in_stock', to: 'espera@mail.com' } })
    expect(mail.subject).toBe('Volvió Producto ma-serum')
  })
})

describe('reviews (PDP-07)', () => {
  it('only from a delivered purchase, once per line, moderated, shown from the minimum', async () => {
    const orderId = await buy('eva@mail.com')
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    const token = sign('review', o.id)
    expect(await after.reviewableLines(db, o.number, { token })).toBeNull() // not delivered yet
    await confirmTransfer(db, orderId, admin)
    await db.$transaction(async (tx) => {
      await moveOrder(tx, orderId, 'SHIPPED', SYSTEM)
      await moveOrder(tx, orderId, 'DELIVERED', SYSTEM)
    })
    expect(await after.reviewableLines(db, o.number, { token: 'falso' })).toBeNull()
    const line = o.items[0]!
    const input = { orderItemId: line.id, rating: 5, title: 'Muy suave', body: 'Lo uso todas las noches y me deja la piel muy suave.', usageTime: 'De 2 a 4 semanas' }
    expect((await after.submitReview(db, o.number, { token }, input)).ok).toBe(true)
    expect((await after.submitReview(db, o.number, { token }, input)).ok).toBe(false)

    const review = await db.review.findFirstOrThrow({ where: { orderItemId: line.id } })
    expect(review.status).toBe('PENDING')
    expect(review.authorName).toBe('Lucía G.')
    expect((await after.productReviews(db, line.productId!, 3)).show).toBe(false)
    await db.review.update({ where: { id: review.id }, data: { status: 'APPROVED' } })
    const shown = await after.productReviews(db, line.productId!, 1)
    expect(shown).toMatchObject({ show: true, count: 1, average: 5 })
  })
})
