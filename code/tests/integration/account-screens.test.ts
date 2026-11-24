// The account screens' own logic against PostgreSQL:
//   PDP-09 the product tapped before signing in is saved on return, once, and only if published.
//   CU-12  "Volver a comprar" puts the order's SKUs and quantities in the cart; what cannot be sold is skipped.
//   CU-14  the withdrawal link only on a delivered order inside its 10 days.
//   CU-15  favourites list only published products, the latest first.
//   CU-16  addresses pass the checkout's own check; one default address at a time.
//   CU-05  an expired or used reset link is known before she types.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const acc = await import('../../src/server/customers/account')
const history = await import('../../src/server/customers/history')
const profile = await import('../../src/server/customers/profile')
const { addToCart, ensureCart } = await import('../../src/server/commerce/cart')
const { placeOrder } = await import('../../src/server/commerce/checkout')
const { optionKey } = await import('../../src/server/commerce/shipping/quote')
const { saveSettings, loadSettings } = await import('../../src/server/settings')
const { emptyContact, CHECKOUT_ERRORS } = await import('../../src/lib/commerce/checkout-form')

let db: PrismaClient

async function customer(email: string) {
  const r = await acc.registerCustomer(db, { name: 'Ana', email, password: 'clave-segura', acceptedTerms: true, newsletter: false })
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.customerId
}

async function buy(customerId: string, email: string, lines: { sku: string; quantity: number }[]) {
  const { cartId, newToken } = await ensureCart(db, null, customerId)
  for (const l of lines) await addToCart(db, cartId, l)
  const r = await placeOrder(
    db,
    {
      cartToken: newToken,
      customerId,
      contact: { ...emptyContact(), email, firstName: 'Ana', lastName: 'Pérez', dni: '30123456', phone: '011 15 5039-0302', street: 'Calle 1', postcode: '1414', locality: 'CABA', province: 'C' },
      shippingKey: optionKey({ provider: 'tabla', carrier: 'Correo Argentino', service: 'AMBA' }),
      method: 'transfer',
      acceptedTerms: true,
    },
    { payments: null, shipping: null },
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  return db.order.findUniqueOrThrow({ where: { id: r.orderId } })
}

const address = (extra: Partial<Record<(typeof profile.ADDRESS_FIELDS)[number], string>> = {}) => ({
  firstName: 'Ana',
  lastName: 'Pérez',
  dni: '30.123.456',
  phone: '+54 9 11 5039-0302',
  street: 'Av. Siempreviva 742',
  unit: '',
  postcode: '1414',
  locality: 'CABA',
  province: 'C',
  notes: '',
  ...extra,
})

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, shipping_rates, shipping_boxes, email_messages, payment_notifications, newsletter_subscribers, withdrawal_requests, back_in_stock_requests CASCADE`,
  )
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(baseCatalog()) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 20 } })
  await saveSettings(db, { 'company.bankHolder': 'Larutina S.A.', 'company.bankAlias': 'larutina.pagos' })
  await db.shippingRate.create({ data: { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Correo Argentino', priceCents: 500_000, minDays: 2, maxDays: 4 } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('favourite saved after signing in (PDP-09)', () => {
  it('saves the product she tapped, once, and never a product that is not published', async () => {
    const id = await customer('fav@mail.com')
    expect(await history.saveFavorite(db, id, 'ma-serum')).toBe(true)
    expect(await history.saveFavorite(db, id, 'ma-serum')).toBe(true) // coming back twice does not toggle it off
    expect(await db.favorite.count({ where: { customerId: id } })).toBe(1)

    await db.product.update({ where: { code: 'ma-gel' }, data: { status: 'DRAFT' } })
    expect(await history.saveFavorite(db, id, 'ma-gel')).toBe(false)
    expect(await history.saveFavorite(db, id, 'no-existe')).toBe(false)
    await db.product.update({ where: { code: 'ma-gel' }, data: { status: 'ACTIVE' } })

    const serum = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    expect(await history.isFavorite(db, id, serum.id)).toBe(true)
  })

  it('lists favourites latest first and drops the ones no longer published (CU-15)', async () => {
    const id = await customer('lista@mail.com')
    await history.saveFavorite(db, id, 'ma-serum')
    await new Promise((r) => setTimeout(r, 5))
    await history.saveFavorite(db, id, 'ma-gel')
    const s = await loadSettings(db)
    expect((await history.favoriteItems(db, id, s)).map((p) => p.code)).toEqual(['ma-gel', 'ma-serum'])
    await db.product.update({ where: { code: 'ma-gel' }, data: { status: 'ARCHIVED' } })
    expect((await history.favoriteItems(db, id, s)).map((p) => p.code)).toEqual(['ma-serum'])
    await db.product.update({ where: { code: 'ma-gel' }, data: { status: 'ACTIVE' } })
  })
})

describe('Volver a comprar (CU-12)', () => {
  it('adds the same SKUs and quantities to the cart, only for her own order', async () => {
    const id = await customer('vuelve@mail.com')
    const order = await buy(id, 'vuelve@mail.com', [
      { sku: 'MA-GEL-150', quantity: 2 },
      { sku: 'MA-SER-30', quantity: 1 },
    ])
    const { cartId } = await ensureCart(db, null, id)
    const r = await history.reorder(db, id, order.number, cartId)
    expect(r).toEqual({ ok: true, added: 2, skipped: [] })
    const items = await db.cartItem.findMany({ where: { cartId }, include: { variant: { select: { sku: true } } } })
    expect(items.map((i) => [i.variant.sku, i.quantity]).sort()).toEqual([
      ['MA-GEL-150', 2],
      ['MA-SER-30', 1],
    ])

    const other = await customer('otra@mail.com')
    const { cartId: otherCart } = await ensureCart(db, null, other)
    expect(await history.reorder(db, other, order.number, otherCart)).toEqual({ ok: false })
    expect(await db.cartItem.count({ where: { cartId: otherCart } })).toBe(0)
  })

  it('skips and names what can no longer be bought', async () => {
    const id = await customer('agotado@mail.com')
    const order = await buy(id, 'agotado@mail.com', [
      { sku: 'MA-GEL-150', quantity: 1 },
      { sku: 'MA-SER-30', quantity: 1 },
    ])
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 0 } })
    const { cartId } = await ensureCart(db, null, id)
    const r = await history.reorder(db, id, order.number.replace('LR-', ''), cartId)
    expect(r).toEqual({ ok: true, added: 1, skipped: ['Producto ma-serum'] })
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 20 } })
  })
})

describe('the withdrawal link on an order (CU-14)', () => {
  it('shows only on a delivered order, for 10 calendar days', () => {
    const now = new Date('2026-12-20T12:00:00Z')
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
    expect(history.withdrawalOpen({ status: 'DELIVERED', deliveredAt: days(3) }, now)).toBe(true)
    expect(history.withdrawalOpen({ status: 'PARTIALLY_REFUNDED', deliveredAt: days(9.9) }, now)).toBe(true)
    expect(history.withdrawalOpen({ status: 'DELIVERED', deliveredAt: days(10) }, now)).toBe(false)
    expect(history.withdrawalOpen({ status: 'SHIPPED', deliveredAt: null }, now)).toBe(false)
    expect(history.withdrawalOpen({ status: 'REFUNDED', deliveredAt: days(2) }, now)).toBe(false)
  })

  it('"Seguir envío" goes to the carrier, or to the order page when there is only a code', () => {
    expect(history.trackingTarget({ trackingUrl: 'https://seguimiento.example/123', trackingCode: '123' })).toBe('url')
    expect(history.trackingTarget({ trackingUrl: 'javascript:alert(1)', trackingCode: '123' })).toBe('order')
    expect(history.trackingTarget({ trackingUrl: null, trackingCode: null })).toBeNull()
    expect(history.trackingTarget(null)).toBeNull()
  })
})

describe('Mis datos (CU-16)', () => {
  it('checks addresses like the checkout and keeps one default', async () => {
    const id = await customer('dir@mail.com')
    const bad = await profile.saveAddress(db, id, null, address({ postcode: '5500', street: '' }))
    expect(!bad.ok && bad.errors).toEqual({ postcode: CHECKOUT_ERRORS.postcode, street: CHECKOUT_ERRORS.required })

    const first = await profile.saveAddress(db, id, null, address())
    if (!first.ok) throw new Error()
    const a1 = await db.address.findUniqueOrThrow({ where: { id: first.id } })
    expect(a1).toMatchObject({ isDefault: true, dni: '30123456', phone: '1150390302', unit: null })

    const second = await profile.saveAddress(db, id, null, { ...address({ street: 'Belgrano 100', postcode: 'X5000ABC', province: 'X', locality: 'Córdoba' }), isDefault: true })
    if (!second.ok) throw new Error()
    expect(await db.address.findMany({ where: { customerId: id, isDefault: true }, select: { id: true } })).toEqual([{ id: second.id }])

    await profile.deleteAddress(db, id, second.id)
    expect((await db.address.findUniqueOrThrow({ where: { id: first.id } })).isDefault).toBe(true)

    const intruder = await customer('intrusa@mail.com')
    const r = await profile.saveAddress(db, intruder, first.id, address({ street: 'Otra 1' }))
    expect(r.ok).toBe(false)
    await profile.deleteAddress(db, intruder, first.id)
    expect(await db.address.count({ where: { id: first.id } })).toBe(1)
  })

  it('saves personal data, checking DNI and phone only when written', async () => {
    const id = await customer('datos@mail.com')
    const bad = await profile.updateProfile(db, id, { firstName: '', lastName: '', dni: '12', phone: '123' })
    expect(!bad.ok && bad.errors).toEqual({ firstName: CHECKOUT_ERRORS.required, dni: CHECKOUT_ERRORS.dni, phone: CHECKOUT_ERRORS.phone })
    expect((await profile.updateProfile(db, id, { firstName: 'Ana', lastName: 'Pérez', dni: '', phone: '' })).ok).toBe(true)
    expect(await db.customer.findUniqueOrThrow({ where: { id } })).toMatchObject({ firstName: 'Ana', lastName: 'Pérez', dni: null, phone: null })
  })
})

describe('reset link (CU-05)', () => {
  it('is valid until used', async () => {
    await customer('reset@mail.com')
    await acc.requestPasswordReset(db, 'reset@mail.com')
    const email = await db.emailMessage.findFirstOrThrow({ where: { template: 'password_reset', to: 'reset@mail.com' } })
    const token = /nueva-contrasena\?t=([\w-]+)/.exec(email.text)![1]!
    expect(await acc.resetLinkValid(db, token)).toBe(true)
    expect(await acc.resetLinkValid(db, 'falso')).toBe(false)
    expect((await acc.resetPassword(db, token, 'nueva-clave', 'nueva-clave')).ok).toBe(true)
    expect(await acc.resetLinkValid(db, token)).toBe(false)
  })
})
