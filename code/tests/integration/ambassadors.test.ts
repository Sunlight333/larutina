// Ambassadors against PostgreSQL (H3 step 6, done-when):
//   - Changing a commission % does not alter commissions already generated (EMB-04).
//   - An order never pays two ambassadors (EMB-03).
// Plus: application received and approved (EMB-01), code and link attribution
// within 30 days (EMB-02), self-purchase blocked (EB-C03), approval 15 days
// after delivery (EB-C04), a total refund cancels the pending commission
// (PED-03), a refund after payout is deducted next month (IR-16), monthly
// settlement with a minimum carried over (EMB-05).
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const program = await import('../../src/server/ambassadors/program')
const commissions = await import('../../src/server/ambassadors/commissions')
const { addToCart, ensureCart, findCart, hashCartToken } = await import('../../src/server/commerce/cart')
const { placeOrder } = await import('../../src/server/commerce/checkout')
const { confirmTransfer } = await import('../../src/server/commerce/payments')
const { moveOrder, SYSTEM } = await import('../../src/server/commerce/orders')
const { refundOrder } = await import('../../src/server/commerce/refunds')
const { optionKey } = await import('../../src/server/commerce/shipping/quote')
const { saveSettings, loadSettings } = await import('../../src/server/settings')
const { emptyContact } = await import('../../src/lib/commerce/checkout-form')
const { encodeRef } = await import('../../src/lib/commerce/attribution')

let db: PrismaClient
const admin = { id: 'a1', email: 'equipo@larutina.test' }
const DAY = 86_400_000

async function approved(name: string, email: string, extra: Partial<{ commissionPct: number; cuit: string }> = {}) {
  const r = await program.applyAsAmbassador(db, { name, email, phone: '11 5039-0302', profession: 'Cosmetóloga', license: '', licenseFile: null, city: 'CABA', workplaces: ['Consultorio'], social: '', motivation: 'Recomiendo con criterio.', privacyAccepted: true })
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  const a = await db.ambassador.findUniqueOrThrow({ where: { id: r.id } })
  const code = await program.suggestCode(db, a.firstName, a.lastName)
  const ok = await program.approveAmbassador(db, a.id, { code, commissionPct: extra.commissionPct ?? null, customerDiscountPct: null, cuit: extra.cuit ?? '', payoutAccount: 'alias.de.ella' })
  if (!ok.ok) throw new Error(ok.error)
  return db.ambassador.findUniqueOrThrow({ where: { id: a.id } })
}

async function buy(opts: { email?: string; dni?: string; code?: string; cartRef?: string; cookie?: string }) {
  const { cartId, newToken } = await ensureCart(db, null, null)
  await addToCart(db, cartId, { sku: 'MA-SER-30', quantity: 1 })
  if (opts.code || opts.cartRef) await db.cart.update({ where: { id: cartId }, data: { couponCode: opts.code ?? null, ambassadorCode: opts.cartRef ?? null } })
  const r = await placeOrder(
    db,
    {
      cartToken: newToken,
      customerId: null,
      contact: { ...emptyContact(), email: opts.email ?? 'clienta@mail.com', firstName: 'Clara', lastName: 'Ruiz', dni: opts.dni ?? '28111222', phone: '11 4444-5555', street: 'Calle 1', postcode: '1414', locality: 'CABA', province: 'C' },
      shippingKey: optionKey({ provider: 'tabla', carrier: 'Correo Argentino', service: 'AMBA' }),
      method: 'transfer',
      acceptedTerms: true,
      refCookie: opts.cookie ?? null,
    },
    { payments: null, shipping: null },
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  return r.orderId
}

async function deliver(orderId: string, at: Date) {
  await confirmTransfer(db, orderId, admin)
  await db.$transaction(async (tx) => {
    await moveOrder(tx, orderId, 'SHIPPED', SYSTEM)
    await moveOrder(tx, orderId, 'DELIVERED', SYSTEM)
  })
  await db.order.update({ where: { id: orderId }, data: { deliveredAt: at } })
}

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, shipping_rates, email_messages, ambassadors, commission_payouts, commission_adjustments CASCADE`,
  )
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(baseCatalog()) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 100 } })
  await saveSettings(db, { 'company.bankHolder': 'Larutina S.A.', 'company.bankAlias': 'larutina.pagos', 'ambassadors.customerDiscountPct': 10 })
  await db.shippingRate.create({ data: { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Correo Argentino', priceCents: 500_000, minDays: 2, maxDays: 4 } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('application and approval (EMB-01)', () => {
  it('is received with an email, pending until approved, then gets her code and the approval email', async () => {
    const a = await approved('Ana María Pérez', 'ana.prof@mail.com')
    expect(a.status).toBe('APPROVED')
    expect(a.code).toBe('ANAMARIAPEREZ')
    expect(await db.emailMessage.count({ where: { to: 'ana.prof@mail.com', template: { in: ['ambassador_received', 'ambassador_approved'] } } })).toBe(2)
    const dup = await program.applyAsAmbassador(db, { name: 'Ana Pérez', email: 'ana.prof@mail.com', phone: '1150390302', profession: 'Otra', license: '', licenseFile: null, city: 'x', workplaces: ['Online'], social: '', motivation: 'x', privacyAccepted: true })
    expect(!dup.ok && dup.errors.email).toBe(program.APPLY_ERRORS.duplicate)
  })
})

describe('attribution and commission (EMB-02..EMB-04)', () => {
  it('her code gives her discount and, once paid, one pending commission on the price without VAT', async () => {
    const a = await approved('Bea Gómez', 'bea.prof@mail.com')
    const orderId = await buy({ code: a.code! })
    let order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    expect(order.ambassadorId).toBe(a.id)
    expect(order.attributionSource).toBe('CODE')
    expect(order.codeDiscountCents).toBe(189_000) // 10% of $18.900
    expect(await db.commission.count({ where: { orderId } })).toBe(0) // unpaid: nothing yet
    await confirmTransfer(db, orderId, admin)
    const c = await db.commission.findUniqueOrThrow({ where: { orderId } })
    order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    // Line total after code and transfer discounts, without 21% VAT, at 15%.
    const base = Math.round(order.items[0]!.totalCents / 1.21)
    expect(c).toMatchObject({ status: 'PENDING', baseCents: base, amountCents: Math.round(base * 0.15) })
  })

  it('changing a % does not alter commissions already generated', async () => {
    const a = await approved('Caro Díaz', 'caro.prof@mail.com')
    const orderId = await buy({ code: a.code! })
    await confirmTransfer(db, orderId, admin)
    const before = (await db.commission.findUniqueOrThrow({ where: { orderId } })).amountCents
    await saveSettings(db, { 'ambassadors.commissionPct': 30 })
    await db.ambassador.update({ where: { id: a.id }, data: { commissionPct: 25 } })
    expect((await db.commission.findUniqueOrThrow({ where: { orderId } })).amountCents).toBe(before)
    await saveSettings(db, { 'ambassadors.commissionPct': 15 })
  })

  it('an order never pays two ambassadors: the typed code wins over another one’s link', async () => {
    const one = await approved('Dana Ríos', 'dana.prof@mail.com')
    const two = await approved('Eli Sosa', 'eli.prof@mail.com')
    const orderId = await buy({ code: one.code!, cartRef: two.code!, cookie: encodeRef(two.code!, new Date()) })
    await confirmTransfer(db, orderId, admin)
    expect(await db.attribution.findMany({ where: { orderId } })).toEqual([expect.objectContaining({ ambassadorId: one.id, source: 'CODE' })])
    expect(await db.commission.count({ where: { orderId } })).toBe(1)
    // Paying again (a duplicate confirmation) creates nothing more.
    await expect(confirmTransfer(db, orderId, admin)).resolves.toBeTruthy()
    expect(await db.commission.count({ where: { orderId } })).toBe(1)
  })

  it('her link counts for 30 days on the device, not after', async () => {
    const a = await approved('Flor Paz', 'flor.prof@mail.com')
    const fresh = await buy({ cookie: encodeRef(a.code!, new Date(Date.now() - 29 * DAY)) })
    expect((await db.order.findUniqueOrThrow({ where: { id: fresh } })).attributionSource).toBe('COOKIE')
    const stale = await buy({ cookie: encodeRef(a.code!, new Date(Date.now() - 31 * DAY)) })
    expect((await db.order.findUniqueOrThrow({ where: { id: stale } })).ambassadorId).toBeNull()
  })

  it('her own purchase earns nothing (email, or the DNI in her CUIT)', async () => {
    const a = await approved('Gabi Luna', 'gabi.prof@mail.com', { cuit: '27-30123456-8' })
    const byEmail = await buy({ code: a.code!, email: 'gabi.prof@mail.com' })
    const byDni = await buy({ code: a.code!, dni: '30123456' })
    for (const id of [byEmail, byDni]) {
      await confirmTransfer(db, id, admin)
      expect(await db.commission.count({ where: { orderId: id } })).toBe(0)
      expect(await db.orderEvent.count({ where: { orderId: id, message: { contains: 'propia embajadora' } } })).toBe(1)
    }
  })
})

describe('lifecycle and settlement (EB-C04, EB-C05, PED-03, IR-16)', () => {
  it('approves 15 days after delivery, settles the month with the minimum, deducts a later refund next month', async () => {
    const a = await approved('Hebe Mar', 'hebe.prof@mail.com')
    const s = await loadSettings(db)
    const orderId = await buy({ code: a.code! })
    await deliver(orderId, new Date(Date.now() - 16 * DAY))
    expect(await commissions.approveDueCommissions(db, s, new Date(Date.now() - 2 * DAY))).toBe(0) // 14 days after: still pending
    expect(await commissions.approveDueCommissions(db, s)).toBeGreaterThanOrEqual(1)
    const c = await db.commission.findUniqueOrThrow({ where: { orderId } })
    expect(c.status).toBe('APPROVED')

    // A minimum above what she has: nothing settles, it waits.
    const last = new Date(Date.now() - 40 * DAY)
    const period = commissions.periodOf(new Date())
    const previous = commissions.periodOf(last)
    await db.commission.update({ where: { id: c.id }, data: { approvedAt: last } })
    await saveSettings(db, { 'ambassadors.minimumPayoutCents': 100_000_000 })
    expect(await commissions.settleMonth(db, await loadSettings(db), previous, admin.email)).toEqual([])
    await saveSettings(db, { 'ambassadors.minimumPayoutCents': 0 })
    const [payoutId] = await commissions.settleMonth(db, await loadSettings(db), previous, admin.email)
    expect(payoutId).toBeTruthy()
    expect(await db.emailMessage.count({ where: { to: 'hebe.prof@mail.com', template: 'ambassador_settlement' } })).toBe(1)
    await commissions.markPayoutPaid(db, payoutId!, 'FC A 0001-00000042')
    expect((await db.commission.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('PAID')

    // Refunded after she was paid: deducted from the next settlement.
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    await refundOrder(db, orderId, admin, { lines: order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity, restock: true })), includeShipping: true, reason: 'Arrepentimiento' })
    const adj = await db.commissionAdjustment.findFirstOrThrow({ where: { orderId } })
    expect(adj.amountCents).toBe(-c.amountCents)
    expect(period).toMatch(/^\d{4}-\d{2}$/)
  })

  it('a total refund before payout cancels the pending commission', async () => {
    const a = await approved('Iris Sol', 'iris.prof@mail.com')
    const orderId = await buy({ code: a.code! })
    await confirmTransfer(db, orderId, admin)
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    await refundOrder(db, orderId, admin, { lines: order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity, restock: true })), includeShipping: true, reason: 'Cancelado' })
    expect((await db.commission.findUniqueOrThrow({ where: { orderId } })).status).toBe('CANCELLED')
  })
})

describe('the cart shows the recommendation (G-10, BO-06)', () => {
  it('names the ambassador whose code or link is on the cart', async () => {
    const a = await approved('Juli Mora', 'juli.prof@mail.com')
    const { cartId, newToken } = await ensureCart(db, null, null)
    await addToCart(db, cartId, { sku: 'MA-SER-30', quantity: 1 })
    await db.cart.update({ where: { token: hashCartToken(newToken!) }, data: { ambassadorCode: a.code } })
    const { viewCart } = await import('../../src/server/commerce/cart')
    const v = await viewCart(db, await findCart(db, newToken))
    expect(v.ambassador).toMatchObject({ firstName: 'Juli', source: 'link' })
  })
})
