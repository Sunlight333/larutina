// Routines against PostgreSQL (H3 step 1):
//   RUT-02 the routine price follows the product prices and never goes above their sum.
//   RUT-03 buying the whole routine in one action; the cart shows its saving; removing a required step loses it.
//   RUT-04 with halves enabled, the morning alone earns the discount; disabled, only the whole routine.
//   RUT-05/06 saving warns about two retinoids the same night and irritants in a routine for sensitive skin.
//   CMP-02 routine or code: the larger applies.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, product, toXlsx, variant } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const { ensureCart, findCart, viewCart, setLineQuantity } = await import('../../src/server/commerce/cart')
const { addRoutineToCart } = await import('../../src/server/commerce/routines')
const { saveRoutine } = await import('../../src/server/services/admin/routines')

let db: PrismaClient
const actor = { id: 'a1', email: 'equipo@larutina.test' }

const fixture = () => {
  const c = baseCatalog()
  c.Ingredientes!.push({ codigo_ingrediente: 'retinal', nombre_comun: 'Retinal', nombre_inci: 'Retinal', es_activo_clave: 'Sí', es_irritante: 'Sí', familia: 'retinoide' })
  c.Productos!.push(product('ma-spf', { paso_rutina: 'Protector solar', momento: 'AM', categoria: 'limpiadores', inci: 'Water' }))
  c.Productos!.push(product('ma-crema-retinal', { paso_rutina: 'Hidratante', inci: 'Water, Retinal' }))
  c.Productos!.push(product('ma-contorno-retinal', { paso_rutina: 'Contorno de ojos', inci: 'Water, Retinal' }))
  c.Variantes!.push(variant('MA-SPF-50', 'ma-spf', { precio_ars: '12000', variante_principal: 'Sí' }))
  c.Variantes!.push(variant('MA-CRE-50', 'ma-crema-retinal', { precio_ars: '20000', variante_principal: 'Sí' }))
  c.Variantes!.push(variant('MA-CON-15', 'ma-contorno-retinal', { precio_ars: '15000', variante_principal: 'Sí' }))
  return c
}

const step = (mainProduct: string, moment: 'AM' | 'PM' | 'BOTH', optional = false) => ({ moment, stepType: '', title: 'Paso', mainProduct, alternatives: [], instruction: null, frequency: null, optional })
const base = { goal: 'Probar.', moment: 'BOTH' as const, difficulty: null, description: null, status: 'PUBLISHED' as const, skinTypes: ['grasa'], concerns: [] }

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, audit_logs CASCADE`,
  )
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(fixture()) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 10 } })
  // Gel $9.900 (both), SPF $12.000 (morning, required), serum $18.900 (night), and an optional morning step.
  const r = await saveRoutine(db, actor, null, { ...base, code: 'rutina-dia-noche', name: 'Día y noche', discountPct: 10, discountHalves: false, steps: [step('ma-gel', 'BOTH'), step('ma-spf', 'AM'), step('ma-serum', 'PM'), step('ma-crema-retinal', 'AM', true)] })
  expect(r.ok).toBe(true)
})

afterAll(async () => {
  await db.$disconnect()
})

async function cartWithRoutine(code: string, scope: 'full' | 'am' | 'pm' = 'full', skip: string[] = []) {
  const { cartId, newToken } = await ensureCart(db, null, null)
  const added = await addRoutineToCart(db, cartId, { code, scope, skip })
  return { token: newToken!, added }
}

describe('routines in the cart (RUT-02, RUT-03)', () => {
  it('adds every step in one action and the cart applies the routine discount', async () => {
    const { token, added } = await cartWithRoutine('rutina-dia-noche')
    expect(added!.added).toBe(4)
    const view = await viewCart(db, await findCart(db, token))
    expect(view.routines[0]).toMatchObject({ name: 'Día y noche', scope: 'full', discountPct: 10 })
    expect(view.pricing.subtotalCents).toBe(6_080_000)
    expect(view.pricing.routineDiscountCents).toBe(608_000)
    expect(view.pricing.totalCents).toBeLessThanOrEqual(view.pricing.subtotalCents)
  })

  it('leaving out the optional step keeps the discount; removing a required one loses it', async () => {
    const opt = await db.routineStep.findFirstOrThrow({ where: { routine: { code: 'rutina-dia-noche' }, optional: true } })
    const { token } = await cartWithRoutine('rutina-dia-noche', 'full', [opt.id])
    let view = await viewCart(db, await findCart(db, token))
    expect(view.lines).toHaveLength(3)
    expect(view.pricing.routineDiscountCents).toBe(408_000)
    const spf = view.lines.find((l) => l.sku === 'MA-SPF-50')!
    await setLineQuantity(db, view.id!, spf.id, 0)
    view = await viewCart(db, await findCart(db, token))
    expect(view.routines[0]!.scope).toBeNull()
    expect(view.pricing.routineDiscountCents).toBe(0)
  })

  it('the price follows a price change (RUT-02)', async () => {
    const { token } = await cartWithRoutine('rutina-dia-noche')
    await db.productVariant.update({ where: { sku: 'MA-SPF-50' }, data: { priceCents: 2_200_000 } })
    const view = await viewCart(db, await findCart(db, token))
    expect(view.pricing.routineDiscountCents).toBe(708_000)
    await db.productVariant.update({ where: { sku: 'MA-SPF-50' }, data: { priceCents: 1_200_000 } })
  })
})

describe('halves (RUT-04)', () => {
  it('only the whole routine when halves are off; the morning alone when on', async () => {
    const off = await cartWithRoutine('rutina-dia-noche', 'am')
    expect((await viewCart(db, await findCart(db, off.token))).pricing.routineDiscountCents).toBe(0)
    await db.routine.update({ where: { code: 'rutina-dia-noche' }, data: { discountHalves: true } })
    const on = await cartWithRoutine('rutina-dia-noche', 'am')
    const view = await viewCart(db, await findCart(db, on.token))
    expect(view.routines[0]!.scope).toBe('am')
    // Gel + SPF + the optional morning cream: 9.900 + 12.000 + 20.000, 10%.
    expect(view.pricing.routineDiscountCents).toBe(419_000)
    await db.routine.update({ where: { code: 'rutina-dia-noche' }, data: { discountHalves: false } })
  })
})

describe('routine or code (CMP-02, BO-07)', () => {
  it('a larger code wins over the routine discount, a smaller one is outdone', async () => {
    await db.coupon.create({ data: { code: 'QUINCE', kind: 'PERCENT', value: 15 } })
    await db.coupon.create({ data: { code: 'CINCO', kind: 'PERCENT', value: 5 } })
    const a = await cartWithRoutine('rutina-dia-noche')
    await db.cart.update({ where: { id: (await findCart(db, a.token))!.id }, data: { couponCode: 'QUINCE' } })
    const va = await viewCart(db, await findCart(db, a.token))
    expect(va.pricing.applied).toBe('code')
    const b = await cartWithRoutine('rutina-dia-noche')
    await db.cart.update({ where: { id: (await findCart(db, b.token))!.id }, data: { couponCode: 'CINCO' } })
    const vb = await viewCart(db, await findCart(db, b.token))
    expect(vb.pricing.applied).toBe('routine')
    expect(vb.pricing.codeOutdone).toBe(true)
  })
})

describe('checks on save (RUT-05, RUT-06)', () => {
  it('two retinoids the same night warn, and so does an irritant in a routine for sensitive skin', async () => {
    const r = await saveRoutine(db, actor, null, { ...base, code: 'noche-retinal', name: 'Noche retinal', discountPct: 0, discountHalves: false, skinTypes: ['sensible'], steps: [step('ma-crema-retinal', 'PM'), step('ma-contorno-retinal', 'PM')] })
    if (!r.ok) throw new Error(r.error)
    expect(r.warnings.filter((w) => w.kind === 'duplicate')).toHaveLength(1)
    expect(r.warnings.filter((w) => w.kind === 'sensitive').length).toBeGreaterThanOrEqual(2)
    expect(await db.auditLog.count({ where: { entityType: 'Routine' } })).toBeGreaterThanOrEqual(2)
  })

  it('refuses a kit or an unknown product as a step (CAT-07)', async () => {
    const r = await saveRoutine(db, actor, null, { ...base, code: 'mala', name: 'Mala', discountPct: 0, discountHalves: false, steps: [step('no-existe', 'AM')] })
    expect(!r.ok && r.error).toContain('no hay un producto')
  })
})
