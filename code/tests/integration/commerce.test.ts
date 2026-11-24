// Commerce against PostgreSQL: the "done when" list of Phase 2 (06), plus the
// transfer and cash reminders, the abandoned cart, coupons, the cap and
// refunds.
//   - A concurrency test shows no oversell.
//   - A replayed payment notification changes nothing.
//   - An unpaid transfer releases stock and cancels.
//   - With the shipping API down, fallback rates are shown and the purchase completes.
//   - Selling a kit decrements only the kit's stock.
//   - Cost never appears outside the admin role (the public cart).
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const { addToCart, ensureCart, findCart, viewCart, hashCartToken } = await import('../../src/server/commerce/cart')
const { placeOrder } = await import('../../src/server/commerce/checkout')
const { receiveNotification, syncPayment, attachTransferReceipt, confirmTransfer } = await import('../../src/server/commerce/payments')
const { SimulatorProvider } = await import('../../src/server/commerce/payments/simulator')
const { expireOrders, sendReminders, sendAbandonedCarts } = await import('../../src/server/commerce/sweep')
const { refundOrder } = await import('../../src/server/commerce/refunds')
const { moveOrder, SYSTEM } = await import('../../src/server/commerce/orders')
const { quoteShipping, optionKey } = await import('../../src/server/commerce/shipping/quote')
const { publicCart } = await import('../../src/server/commerce/public')
const { saveSettings, loadSettings } = await import('../../src/server/settings')
const { emptyContact } = await import('../../src/lib/commerce/checkout-form')
const { formatARS } = await import('../../src/lib/money')

let db: PrismaClient
let sim: InstanceType<typeof SimulatorProvider>
const admin = { id: 'admin-1', email: 'equipo@larutina.test' }
const HOUR = 3_600_000

const contact = (email = 'ana@mail.com') => ({
  ...emptyContact(),
  email,
  firstName: 'Ana',
  lastName: 'Pérez',
  dni: '30123456',
  phone: '11 5039-0302',
  street: 'Av. Corrientes 1234',
  postcode: 'C1414ABC',
  locality: 'CABA',
  province: 'C',
})

/** A fresh browser cart with these SKUs; returns its cookie token. */
async function cartWith(lines: [string, number][]) {
  const { cartId, newToken } = await ensureCart(db, null, null)
  for (const [sku, quantity] of lines) expect(await addToCart(db, cartId, { sku, quantity, source: 'PDP' })).not.toBeNull()
  return newToken!
}

async function shippingKey(token: string) {
  const s = await loadSettings(db)
  const cart = await viewCart(db, await findCart(db, token))
  const q = await quoteShipping(db, { postcode: 'C1414ABC', province: 'C', parcels: cart.lines.map((l) => l.parcel), goodsCents: cart.pricing.totalCents, freeFromCents: s['commerce.freeShippingFromCents'], maxOptions: 3 }, null)
  if (!q.ok) throw new Error('no quote')
  return optionKey(q.options[0]!)
}

async function place(token: string, method: 'mercadopago' | 'transfer' = 'mercadopago', email?: string) {
  return placeOrder(db, { cartToken: token, customerId: null, contact: contact(email), shippingKey: await shippingKey(token), method, acceptedTerms: true }, { payments: sim, shipping: null })
}

const stock = async (sku: string) => (await db.productVariant.findUniqueOrThrow({ where: { sku } })).stock

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  sim = new SimulatorProvider(db)
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, shipping_rates, shipping_boxes, email_messages, payment_notifications, newsletter_subscribers CASCADE`,
  )
  const report = await importCatalog(db, { name: 'catalogo.xlsx', data: await toXlsx(baseCatalog()) })
  expect(report.status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { costCents: 900_000 } })
  await saveSettings(db, { 'company.bankHolder': 'Larutina S.A.', 'company.bankAlias': 'larutina.pagos', 'commerce.transferDiscountPct': 5 })
  await db.shippingRate.createMany({
    data: [
      { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Correo Argentino', priceCents: 500_000, minDays: 2, maxDays: 4, position: 0 },
      { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Andreani', priceCents: 650_000, minDays: 1, maxDays: 3, position: 1 },
    ],
  })
})

beforeEach(async () => {
  await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 5 } })
  await db.productVariant.update({ where: { sku: 'MA-GEL-150' }, data: { stock: 5 } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('stock without oversell (PED-02)', () => {
  it('of ten buyers racing for three units, exactly three get one', async () => {
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { stock: 3 } })
    const tokens = await Promise.all(Array.from({ length: 10 }, () => cartWith([['MA-SER-30', 1]])))
    const keys = await Promise.all(tokens.map(shippingKey))
    const results = await Promise.all(
      tokens.map((t, i) => placeOrder(db, { cartToken: t, customerId: null, contact: contact(`c${i}@mail.com`), shippingKey: keys[i]!, method: 'mercadopago', acceptedTerms: true }, { payments: sim, shipping: null })),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(3)
    const refused = results.filter((r) => !r.ok)
    expect(refused).toHaveLength(7)
    // CK-18 wording, or the cart noticing the empty shelf first (BO-11).
    for (const r of refused) expect(!r.ok && ['stock', 'cart-changed'].includes(r.reason)).toBe(true)
    expect(await stock('MA-SER-30')).toBe(0)
  })

  it('an unpaid card checkout gives its stock back when it expires, quietly', async () => {
    const t = await cartWith([['MA-GEL-150', 2]])
    const r = await place(t)
    expect(r.ok).toBe(true)
    expect(await stock('MA-GEL-150')).toBe(3)
    await expireOrders(db, await loadSettings(db), new Date(Date.now() + 2 * HOUR))
    expect(await stock('MA-GEL-150')).toBe(5)
    const order = await db.order.findUniqueOrThrow({ where: { id: r.ok ? r.orderId : '' } })
    expect(order.status).toBe('CANCELLED')
    expect(await db.emailMessage.count({ where: { relatedId: order.id, template: 'order_cancelled' } })).toBe(0)
  })
})

describe('Mercado Pago notifications (CMP-04)', () => {
  it('a replayed notification changes nothing', async () => {
    const t = await cartWith([['MA-SER-30', 1]])
    const r = await place(t)
    if (!r.ok) throw new Error(r.reason)
    const payment = await sim.simulate(r.orderId, (await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).totalCents, 'approved')
    const req = { url: new URL('http://x/api/pagos/notificacion'), headers: new Headers(), body: { paymentId: payment.id, nonce: 'n1' } }

    expect((await receiveNotification(db, sim, req)).reason).toBe('paid')
    expect((await receiveNotification(db, sim, req)).reason).toBe('duplicate')
    // A different notification about the same payment is read again, and finds nothing to do.
    expect(await syncPayment(db, sim, payment.id)).toBe('already paid')

    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { events: true, reservations: true } })
    expect(order.status).toBe('PAID')
    expect(order.events.filter((e) => e.toStatus === 'PAID')).toHaveLength(1)
    expect(order.reservations.every((x) => x.status === 'COMMITTED')).toBe(true)
    expect(await db.emailMessage.count({ where: { relatedId: order.id, template: 'order_confirmed' } })).toBe(1)
    expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(1)
    expect(await stock('MA-SER-30')).toBe(4)
  })

  it('a pending cash voucher keeps the stock for 48 h, reminds at 24 h, and only then expires', async () => {
    const t = await cartWith([['MA-SER-30', 1]])
    const r = await place(t)
    if (!r.ok) throw new Error(r.reason)
    const total = (await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).totalCents
    const p = await sim.simulate(r.orderId, total, 'pending')
    expect(await syncPayment(db, sim, p.id)).toBe('pending cash')
    const s = await loadSettings(db)
    expect(await expireOrders(db, s, new Date(Date.now() + 2 * HOUR))).toBe(0)
    await db.payment.updateMany({ where: { externalId: p.id }, data: { createdAt: new Date(Date.now() - 25 * HOUR) } })
    expect(await sendReminders(db, s)).toBeGreaterThanOrEqual(1)
    expect(await db.emailMessage.count({ where: { relatedId: r.orderId, template: 'cash_reminder' } })).toBe(1)
    await expireOrders(db, s, new Date(Date.now() + 49 * HOUR))
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe('CANCELLED')
    // She was told about the voucher, so she is told it expired.
    expect(await db.emailMessage.count({ where: { relatedId: r.orderId, template: 'order_cancelled' } })).toBe(1)
  })
})

describe('bank transfer (CMP-05)', () => {
  it('applies the transfer discount in cascade, reserves, reminds at 3 h, and cancels at 6 h without a receipt', async () => {
    const t = await cartWith([['MA-GEL-150', 1]])
    const r = await place(t, 'transfer')
    if (!r.ok) throw new Error(r.reason)
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId } })
    expect(order.transferDiscountCents).toBe(49_500) // 5% of $9.900, whole pesos
    expect(order.reservedUntil!.getTime() - order.placedAt.getTime()).toBe(6 * HOUR)
    expect(await stock('MA-GEL-150')).toBe(4)
    expect(await db.emailMessage.count({ where: { relatedId: order.id, template: 'transfer_pending' } })).toBe(1)
    // The cart is done.
    expect((await findCart(db, t))!.items).toHaveLength(0)

    const s = await loadSettings(db)
    expect(await sendReminders(db, s, new Date(order.placedAt.getTime() + 3 * HOUR + 1000))).toBe(1)
    expect(await sendReminders(db, s, new Date(order.placedAt.getTime() + 4 * HOUR))).toBe(0)

    await expireOrders(db, s, new Date(order.placedAt.getTime() + 6 * HOUR + 1000))
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CANCELLED')
    expect(await stock('MA-GEL-150')).toBe(5)
    const cancelled = await db.emailMessage.findFirstOrThrow({ where: { relatedId: order.id, template: 'order_cancelled' } })
    expect(cancelled.text).toContain('No recibimos la transferencia a tiempo.')
  })

  it('with a receipt uploaded the order waits for review instead of expiring, and the team confirms it', async () => {
    const t = await cartWith([['MA-GEL-150', 1]])
    const r = await place(t, 'transfer')
    if (!r.ok) throw new Error(r.reason)
    expect(await attachTransferReceipt(db, r.orderId, 'private/receipts/x.pdf', { type: 'CUSTOMER', label: 'ana@mail.com' })).toBe(true)
    await expireOrders(db, await loadSettings(db), new Date(Date.now() + 7 * HOUR))
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe('PENDING_PAYMENT')
    await confirmTransfer(db, r.orderId, admin)
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe('PAID')
    expect(await stock('MA-GEL-150')).toBe(4)
  })
})

describe('shipping (ENV-03, ENV-04)', () => {
  it('with the provider down, the zone table quotes and the purchase completes', async () => {
    const down = { name: 'zipnova', quote: async () => Promise.reject(new Error('503')), createShipment: async () => Promise.reject(new Error('503')), track: async () => Promise.reject(new Error('503')) }
    const s = await loadSettings(db)
    const q = await quoteShipping(db, { postcode: 'C1414ABC', province: 'C', parcels: [], goodsCents: 100_000, freeFromCents: s['commerce.freeShippingFromCents'], maxOptions: 3 }, down)
    expect(q.ok && q.fallback).toBe(true)
    expect(q.ok && q.options.map((o) => o.carrier)).toEqual(['Correo Argentino', 'Andreani'])

    const t = await cartWith([['MA-SER-30', 1]])
    const r = await placeOrder(db, { cartToken: t, customerId: null, contact: contact(), shippingKey: optionKey(q.ok ? q.options[0]! : ({} as never)), method: 'mercadopago', acceptedTerms: true }, { payments: sim, shipping: down })
    expect(r.ok).toBe(true)
  })

  it('over the free-shipping threshold the cheapest option is free (BO-05)', async () => {
    const q = await quoteShipping(db, { postcode: '1414', parcels: [], goodsCents: 10_000_000, freeFromCents: 5_000_000, maxOptions: 3 }, null)
    expect(q.ok && q.options[0]!.priceCents).toBe(0)
    expect(q.ok && q.options[1]!.priceCents).toBe(650_000)
  })
})

describe('kits (CAT-07, D-06)', () => {
  it('selling a kit takes only the kit’s own stock', async () => {
    const serum = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    const kit = await db.product.create({
      data: { code: 'ma-kit', name: 'Kit A', brandId: serum.brandId, categoryId: serum.categoryId, status: 'ACTIVE', type: 'KIT', kitContents: ['MA-SER-30', 'MA-GEL-150'], shortDescription: '', description: '', whyWeChose: '', howToUse: '', texture: 'Fluido', routineStep: 'SERUM', moment: 'PM', publishedAt: new Date() },
    })
    await db.productVariant.create({ data: { sku: 'MA-KIT', productId: kit.id, size: 1, unit: 'UNITS', priceCents: 2_500_000, stock: 2, isMain: true } })
    const t = await cartWith([['MA-KIT', 1]])
    const r = await place(t)
    expect(r.ok).toBe(true)
    expect(await stock('MA-KIT')).toBe(1)
    expect(await stock('MA-SER-30')).toBe(5)
    expect(await stock('MA-GEL-150')).toBe(5)
  })
})

describe('the public cart (CAT-20)', () => {
  it('never carries the cost', async () => {
    const t = await cartWith([['MA-SER-30', 1]])
    const view = await viewCart(db, await findCart(db, t))
    expect(view.lines[0]!.unitCostCents).toBe(900_000)
    expect(JSON.stringify(publicCart(view))).not.toContain('900000')
    expect(JSON.stringify(publicCart(view))).not.toMatch(/cost/i)
  })
})

describe('coupons and the cap (CMP-02, CMP-08)', () => {
  it('refuses a code under its minimum purchase, with its message, in the cart and at checkout', async () => {
    await db.coupon.create({ data: { code: 'HOLA10', kind: 'PERCENT', value: 10, minSubtotalCents: 5_000_000 } })
    const t = await cartWith([['MA-SER-30', 1]])
    const row = await findCart(db, t)
    await db.cart.update({ where: { id: row!.id }, data: { couponCode: 'hola10' } })
    const view = await viewCart(db, await findCart(db, t))
    expect(view.couponError).toBe(`Este código es para compras desde ${formatARS(5_000_000)}.`)
    const r = await place(t)
    expect(!r.ok && r.reason).toBe('coupon')
  })

  it('a first-purchase code is refused to an email that already bought', async () => {
    await db.coupon.create({ data: { code: 'PRIMERA', kind: 'AMOUNT', value: 100_000, firstPurchaseOnly: true } })
    const t1 = await cartWith([['MA-GEL-150', 1]])
    const first = await place(t1, 'transfer', 'compra@mail.com')
    if (!first.ok) throw new Error(first.reason)
    await confirmTransfer(db, first.orderId, admin)
    const t2 = await cartWith([['MA-GEL-150', 1]])
    await db.cart.update({ where: { token: hashCartToken(t2) }, data: { couponCode: 'PRIMERA' } })
    const second = await place(t2, 'transfer', 'compra@mail.com')
    expect(!second.ok && 'message' in second && second.message).toBe('Este código es solo para la primera compra.')
  })

  it('the cap holds on the order', async () => {
    await saveSettings(db, { 'commerce.discountCapPct': 12, 'commerce.transferDiscountPct': 5 })
    await db.coupon.create({ data: { code: 'DIEZ', kind: 'PERCENT', value: 10 } })
    const t = await cartWith([['MA-SER-30', 1]])
    await db.cart.update({ where: { token: hashCartToken(t) }, data: { couponCode: 'DIEZ' } })
    const r = await place(t, 'transfer')
    if (!r.ok) throw new Error(r.reason)
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } })
    expect(o.discountCents).toBeLessThanOrEqual(Math.floor((o.subtotalCents * 12) / 100))
    expect(o.codeDiscountCents).toBe(189_000)
    await saveSettings(db, { 'commerce.discountCapPct': 0 })
  })
})

describe('abandoned cart (EML-04)', () => {
  it('one email, 24 h after the email was left at checkout, never twice', async () => {
    const t = await cartWith([['MA-SER-30', 1]])
    const row = await findCart(db, t)
    await db.cart.update({ where: { id: row!.id }, data: { email: 'deja@mail.com', updatedAt: new Date(Date.now() - 25 * HOUR) } })
    const s = await loadSettings(db)
    expect(await sendAbandonedCarts(db, s)).toBe(1)
    expect(await sendAbandonedCarts(db, s)).toBe(0)
    const email = await db.emailMessage.findFirstOrThrow({ where: { template: 'cart_abandoned', to: 'deja@mail.com' } })
    expect(email.subject).toBe('Tu carrito quedó guardado')
    expect(email.text).toContain('Dejaste Producto ma-serum en el carrito.')
  })
})

describe('refunds (PED-03)', () => {
  it('partial, then total: stock back where asked, status and email each time', async () => {
    const t = await cartWith([['MA-SER-30', 2], ['MA-GEL-150', 1]])
    const r = await place(t, 'transfer')
    if (!r.ok) throw new Error(r.reason)
    await confirmTransfer(db, r.orderId, admin)
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } })
    const serumLine = order.items.find((i) => i.sku === 'MA-SER-30')!
    expect(await stock('MA-SER-30')).toBe(3)

    await refundOrder(db, order.id, admin, { lines: [{ orderItemId: serumLine.id, quantity: 1, restock: true }], includeShipping: false, reason: 'Llegó roto' }, { payments: sim })
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PARTIALLY_REFUNDED')
    expect(await stock('MA-SER-30')).toBe(4)

    const rest = order.items.map((i) => ({ orderItemId: i.id, quantity: i.id === serumLine.id ? 1 : i.quantity, restock: false }))
    await refundOrder(db, order.id, admin, { lines: rest, includeShipping: true, reason: 'Arrepentimiento' }, { payments: sim })
    const done = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { refunds: true } })
    expect(done.status).toBe('REFUNDED')
    expect(done.refunds.reduce((a, x) => a + x.amountCents, 0)).toBe(done.totalCents)
    expect(await db.emailMessage.count({ where: { relatedId: order.id, template: 'refund' } })).toBe(2)
    await expect(refundOrder(db, order.id, admin, { lines: [], includeShipping: false, reason: 'x', amountCents: 100 }, { payments: sim })).rejects.toThrow()
  })

  it('a paid order cannot be cancelled: it leaves through a refund', async () => {
    const t = await cartWith([['MA-GEL-150', 1]])
    const r = await place(t, 'transfer')
    if (!r.ok) throw new Error(r.reason)
    await confirmTransfer(db, r.orderId, admin)
    await expect(db.$transaction((tx) => moveOrder(tx, r.orderId, 'CANCELLED', SYSTEM))).rejects.toThrow()
  })
})
