// The storefront's purchase routes against PostgreSQL: which cart a browser
// uses (CMP-01: guest, signed in, merged at login), the one-time import of
// the Phase 1 localStorage cart, the abandoned-cart recovery link (EML-04),
// the sweep endpoint's guard and lock, the public quote and the receipt file.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const { addToCart, ensureCart, findCart, findCartById, hashCartToken } = await import('../../src/server/commerce/cart')
const access = await import('../../src/server/commerce/cart-access')
const { jobAuthorized, runSweepLocked } = await import('../../src/server/commerce/jobs')
const { saveReceipt } = await import('../../src/server/commerce/receipts')
const { setStorage } = await import('../../src/server/storage')
const { saveSettings, loadSettings } = await import('../../src/server/settings')
const { sign, verify } = await import('../../src/server/secret')

let db: PrismaClient

const skus = async (cartId: string | null) =>
  Object.fromEntries((await db.cartItem.findMany({ where: { cartId: cartId ?? '' }, include: { variant: { select: { sku: true } } } })).map((i) => [i.variant.sku, i.quantity]))

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, shipping_rates, shipping_boxes, email_messages, payment_notifications, newsletter_subscribers, media_assets CASCADE`,
  )
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(baseCatalog()) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 20 } })
  await db.shippingRate.createMany({
    data: [
      { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Andreani', priceCents: 650_000, minDays: 1, maxDays: 3, position: 1 },
      { zone: 'AMBA', provinces: ['C', 'B'], carrier: 'Correo Argentino', priceCents: 500_000, minDays: 2, maxDays: 4, position: 0 },
    ],
  })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('which cart a browser uses (CMP-01)', () => {
  it('a guest gets a cart on the first add and keeps it by its cookie; reading never creates one', async () => {
    expect(await access.locateCart(db, null, null, { create: false, retoken: true })).toEqual({ cartId: null, newToken: null })
    const made = await access.locateCart(db, null, null, { create: true, retoken: true })
    expect(made.cartId).toBeTruthy()
    expect(made.newToken).toBeTruthy()
    expect(await access.locateCart(db, made.newToken, null, { create: true, retoken: true })).toEqual({ cartId: made.cartId, newToken: null })
    // A cookie for a cart already bought starts a new one.
    await db.cart.update({ where: { id: made.cartId! }, data: { convertedAt: new Date() } })
    const next = await access.locateCart(db, made.newToken, null, { create: true, retoken: true })
    expect(next.cartId).not.toBe(made.cartId)
  })

  it('at login the guest cart joins her cart, and this browser gets a token for it', async () => {
    const customer = await db.customer.create({ data: { email: 'lu@mail.com' } })
    const hers = await ensureCart(db, null, customer.id)
    await addToCart(db, hers.cartId, { sku: 'MA-SER-30', quantity: 1 })
    const guest = await ensureCart(db, null, null)
    await addToCart(db, guest.cartId, { sku: 'MA-SER-30', quantity: 2 })
    await addToCart(db, guest.cartId, { sku: 'MA-GEL-150', quantity: 1 })

    // A page only reads: the carts merge, but no new token can be set.
    const read = await access.locateCart(db, guest.newToken, customer.id, { create: false, retoken: false })
    expect(read).toEqual({ cartId: hers.cartId, newToken: null })
    expect(await skus(hers.cartId)).toEqual({ 'MA-SER-30': 3, 'MA-GEL-150': 1 })
    expect(await db.cart.findUnique({ where: { id: guest.cartId } })).toBeNull()

    // The next route call points the cookie at her cart.
    const routed = await access.locateCart(db, guest.newToken, customer.id, { create: true, retoken: true })
    expect(routed.cartId).toBe(hers.cartId)
    expect(routed.newToken).toBeTruthy()
    expect((await findCart(db, routed.newToken))?.id).toBe(hers.cartId)
    // With the new cookie nothing changes again.
    expect(await access.locateCart(db, routed.newToken, customer.id, { create: true, retoken: true })).toEqual({ cartId: hers.cartId, newToken: null })
  })

  it('a guest cart becomes hers when she has none; another account’s cart is never used', async () => {
    const ana = await db.customer.create({ data: { email: 'ana@mail.com' } })
    const guest = await ensureCart(db, null, null)
    expect(await access.locateCart(db, guest.newToken, ana.id, { create: true, retoken: true })).toEqual({ cartId: guest.cartId, newToken: null })
    expect((await db.cart.findUniqueOrThrow({ where: { id: guest.cartId } })).customerId).toBe(ana.id)

    const bea = await db.customer.create({ data: { email: 'bea@mail.com' } })
    const forBea = await access.locateCart(db, guest.newToken, bea.id, { create: true, retoken: true })
    expect(forBea.cartId).not.toBe(guest.cartId)
    expect((await db.cart.findUniqueOrThrow({ where: { id: forBea.cartId! } })).customerId).toBe(bea.id)
  })
})

describe('the Phase 1 cart moves to the server once', () => {
  it('imports valid SKUs, skips the rest, and a repeat changes nothing', async () => {
    const { cartId } = await ensureCart(db, null, null)
    const lines = [{ sku: 'MA-SER-30', qty: 2 }, { sku: 'NO-EXISTE', qty: 1 }, { sku: 'bad sku!', qty: 1 }, { sku: 'MA-GEL-150', qty: 99 }, 'basura']
    expect(await access.importLegacyLines(db, cartId, lines)).toBe(2)
    expect(await skus(cartId)).toEqual({ 'MA-SER-30': 2, 'MA-GEL-150': 10 })
    expect(await access.importLegacyLines(db, cartId, lines)).toBe(0)
    expect(await skus(cartId)).toEqual({ 'MA-SER-30': 2, 'MA-GEL-150': 10 })
    const items = await db.cartItem.findMany({ where: { cartId } })
    expect(items.every((i) => i.source === 'OTHER')).toBe(true)
    expect(await access.importLegacyLines(db, cartId, 'no es una lista')).toBe(0)
  })

  it('an add keeps only a known source and a short reference', () => {
    expect(access.cleanAddInput({ sku: 'MA-SER-30', quantity: 2, source: 'SEARCH', sourceRef: '/buscar?q=serum' })).toEqual({ sku: 'MA-SER-30', quantity: 2, source: 'SEARCH', sourceRef: '/buscar?q=serum' })
    expect(access.cleanAddInput({ sku: 'MA-SER-30', quantity: 500, source: 'HACK' })).toEqual({ sku: 'MA-SER-30', quantity: 10, source: 'OTHER', sourceRef: null })
    expect(access.cleanAddInput({ sku: '../x' })).toBeNull()
  })
})

describe('the abandoned-cart link (EML-04)', () => {
  it('a signed link gives this browser a new token for that cart; a forged one or a bought cart does nothing', async () => {
    const { cartId, newToken } = await ensureCart(db, null, null)
    await addToCart(db, cartId, { sku: 'MA-SER-30', quantity: 1 })
    const t = sign('cart', cartId)
    expect(await access.recoverCart(db, cartId, verify('cart', cartId, 'falso-falso-falso-falso1'))).toBeNull()
    const token = await access.recoverCart(db, cartId, verify('cart', cartId, t))
    expect(token).toBeTruthy()
    expect((await findCart(db, token))?.id).toBe(cartId)
    // The old cookie no longer opens it.
    expect(await findCart(db, newToken)).toBeNull()
    await db.cart.update({ where: { id: cartId }, data: { convertedAt: new Date() } })
    expect(await access.recoverCart(db, cartId, verify('cart', cartId, t))).toBeNull()
    expect((await db.cart.findUniqueOrThrow({ where: { id: cartId } })).token).toBe(hashCartToken(token!))
  })
})

describe('what the storefront shows of a cart', () => {
  it('"Con transferencia" only with a transfer discount offered, and never the cost', async () => {
    const { cartId } = await ensureCart(db, null, null)
    await addToCart(db, cartId, { sku: 'MA-SER-30', quantity: 2 })
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { costCents: 123_400 } })
    await saveSettings(db, { 'commerce.transferDiscountPct': 10 })
    const s = await loadSettings(db)
    const row = await findCartById(db, cartId)
    const { cart } = await access.shopCart(db, row, s, { transferAvailable: true })
    expect(cart.transferTotalCents).toBe(Math.floor((cart.totalCents * 0.9) / 100) * 100)
    expect(JSON.stringify(cart)).not.toContain('123400')
    expect(JSON.stringify(cart)).not.toMatch(/cost|parcel|variantId/i)
    expect((await access.shopCart(db, row, s, { transferAvailable: false })).cart.transferTotalCents).toBeNull()
    await saveSettings(db, { 'commerce.transferDiscountPct': 0 })
    expect((await access.shopCart(db, row, await loadSettings(db), { transferAvailable: true })).cart.transferTotalCents).toBeNull()
  })

  it('quotes cheapest first, keeps the postcode, and hides the provider reference', async () => {
    const { cartId } = await ensureCart(db, null, null)
    await addToCart(db, cartId, { sku: 'MA-GEL-150', quantity: 1 })
    const s = await loadSettings(db)
    const { view } = await access.shopCart(db, await findCartById(db, cartId), s, { transferAvailable: false })
    const q = await access.quoteCart(db, view, s, { postcode: 'c1414abc' })
    expect(q.ok && q.options.map((o) => o.carrier)).toEqual(['Correo Argentino', 'Andreani'])
    expect(q.ok && Object.keys(q.options[0]!).sort()).toEqual(['carrier', 'free', 'key', 'maxDays', 'minDays', 'originalPriceCents', 'priceCents', 'service'])
    expect((await db.cart.findUniqueOrThrow({ where: { id: cartId } })).postcode).toBe('C1414ABC')
    expect(await access.quoteCart(db, view, s, { postcode: '12' })).toEqual({ ok: false, error: 'postcode' })
    expect(await access.quoteCart(db, view, s, { postcode: '9410' })).toEqual({ ok: false, error: 'no-rates' })
  })
})

describe('the sweep endpoint', () => {
  it('needs the secret, and is refused when none is configured', () => {
    expect(jobAuthorized('Bearer abc', undefined)).toBe(false)
    expect(jobAuthorized('Bearer abc', '')).toBe(false)
    expect(jobAuthorized(null, 'abc')).toBe(false)
    expect(jobAuthorized('Bearer abd', 'abc')).toBe(false)
    expect(jobAuthorized('abc', 'abc')).toBe(false)
    expect(jobAuthorized('Bearer abc', 'abc')).toBe(true)
  })

  it('never runs twice at once', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const counts = { expired: 0, reminders: 0, abandoned: 0, reviews: 0, backInStock: 0, commissionsApproved: 0, emails: { sent: 0, failed: 0, skipped: 0 } }
    const first = runSweepLocked(db, async () => {
      await gate
      return counts
    })
    // Let the first take the lock.
    await new Promise((r) => setTimeout(r, 300))
    expect(await runSweepLocked(db, async () => counts)).toBeNull()
    release()
    expect(await first).toEqual(counts)
    // Released: the next run goes ahead (the real sweep, on an empty outbox).
    const real = await runSweepLocked(db)
    expect(real).toMatchObject({ expired: expect.any(Number), emails: { sent: expect.any(Number) } })
  })
})

describe('the transfer receipt file', () => {
  it('takes an image or a PDF into private storage, and refuses anything else', async () => {
    const files = new Map<string, Buffer>()
    setStorage({ put: async (k, d) => void files.set(k, d), get: async (k) => files.get(k) ?? null, delete: async (k) => void files.delete(k) })
    const pdf = await saveReceipt(db, { name: 'comprobante transferencia.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4\n...') }, 'ana@mail.com')
    expect(pdf.ok).toBe(true)
    const key = pdf.ok ? pdf.key : ''
    expect(key).toMatch(/^private\/\d{4}-\d{2}\/[0-9a-f]{12}-comprobante-transferencia\.pdf$/)
    expect(files.has(key)).toBe(true)
    expect(await db.mediaAsset.findUniqueOrThrow({ where: { key } })).toMatchObject({ visibility: 'PRIVATE', mimeType: 'application/pdf' })
    expect((await saveReceipt(db, { name: 'falso.pdf', type: 'application/pdf', data: Buffer.from('hola') }, 'x')).ok).toBe(false)
    expect((await saveReceipt(db, { name: 'virus.exe', type: 'application/x-msdownload', data: Buffer.from('MZ') }, 'x')).ok).toBe(false)
    expect((await saveReceipt(db, { name: 'roto.png', type: 'image/png', data: Buffer.from('no es png') }, 'x')).ok).toBe(false)
  })
})
