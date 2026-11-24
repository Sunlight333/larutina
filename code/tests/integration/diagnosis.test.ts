// The diagnosis against PostgreSQL (H3 steps 2-4):
//   DIA-03 an old diagnosis reproduces with its rule version, after a new version is published.
//   DIA-07 the "avoid retinoids" answer is not stored, nor anything revealing it.
//   DIA-12 a new diagnosis keeps the earlier ones; signup attaches an anonymous one.
//   R-18/R-19 her routine goes into the cart in one action with the routine discount.
//   EM-13/R-21 the routine by email, newsletter only with its own box.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, product, toXlsx, variant } from '../support/catalog-fixture'

process.env.DATABASE_URL = inject('databaseUrl')

const dx = await import('../../src/server/diagnosis')
const { DEFAULT_RULESET } = await import('../../src/lib/diagnosis/ruleset')
const { runDiagnosis } = await import('../../src/lib/diagnosis/run')
const { ensureCart, findCart, viewCart } = await import('../../src/server/commerce/cart')
const { addDiagnosisToCart } = await import('../../src/server/commerce/routines')

let db: PrismaClient

const answers = (avoid: 'si' | 'no' = 'no') =>
  Object.entries({ piel_mediodia: ['brillo_total'], granitos: ['algunos'], mejorar: ['manchas'], reaccion: ['nada'], despues_lavar: ['brillo'], pasos: ['basica'], evitar_retinoides: [avoid], experiencia: ['seguido'] }).map(([questionKey, values]) => ({ questionKey, values }))

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings, carts, orders, coupons, customers, email_messages, diagnoses, diagnosis_rule_sets, newsletter_subscribers CASCADE`,
  )
  const c = baseCatalog()
  c.Productos!.push(product('ma-crema', { paso_rutina: 'Hidratante', momento: 'AM y PM', inci: 'Water' }))
  c.Productos!.push(product('ma-spf', { paso_rutina: 'Protector solar', momento: 'AM', inci: 'Water' }))
  c.Productos![1] = { ...c.Productos![1]!, momento: 'AM y PM' }
  c.Variantes!.push(variant('MA-CRE-50', 'ma-crema', { precio_ars: '15000', variante_principal: 'Sí' }), variant('MA-SPF-50', 'ma-spf', { precio_ars: '12000', variante_principal: 'Sí' }))
  c.Prod_TiposPiel!.push({ codigo_producto: 'ma-crema', codigo_tipo_piel: 'grasa', aptitud: 'Ideal' }, { codigo_producto: 'ma-spf', codigo_tipo_piel: 'grasa', aptitud: 'Apto' })
  expect((await importCatalog(db, { name: 'c.xlsx', data: await toXlsx(c) })).status).toBe('APPLIED')
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  await db.productVariant.updateMany({ data: { stock: 20 } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('diagnosis', () => {
  it('runs on the published rule set and keeps the result, without the session-only answer (DIA-07)', async () => {
    const { code, result } = await dx.diagnoseAndSave(db, answers('si'))
    expect(result.interpretation.skinType).toBe('grasa')
    const row = await db.diagnosis.findUniqueOrThrow({ where: { code } })
    expect(row.ruleVersion).toBe(1)
    const stored = row.answers as { questionKey: string }[]
    expect(stored.some((a) => a.questionKey === 'evitar_retinoides')).toBe(false)
    expect(JSON.stringify(row.result)).not.toContain('retinal y el retinol')
    expect((row.interpretation as { excluded: string[] }).excluded).toEqual([])
    expect((row.result as { steps: unknown[] }).steps.length).toBeGreaterThan(0)
  })

  it('reproduces an old diagnosis with its own version after a new one is published (DIA-03)', async () => {
    const { code } = await dx.diagnoseAndSave(db, answers())
    const before = await db.diagnosis.findUniqueOrThrow({ where: { code } })
    // Version 2 changes what makes a routine "complete".
    const v2 = structuredClone(DEFAULT_RULESET)
    v2.questions.find((q) => q.key === 'pasos')!.options[0]!.signals = { 'steps:complete': 1 }
    const version = await dx.publishRuleSet(db, v2, 'equipo@larutina.test', 'Prueba')
    expect(version).toBe(2)
    expect((await dx.currentRuleSet(db)).version).toBe(2)

    const old = (await dx.ruleSetVersion(db, before.ruleVersion))!
    const again = runDiagnosis(old, answers(), await dx.engineCatalog(db))
    expect(again.steps).toEqual((before.result as { steps: unknown }).steps)
    expect(again.interpretation.steps).toBe('basic')
    const now = runDiagnosis(await dx.currentRuleSet(db), answers(), await dx.engineCatalog(db))
    expect(now.interpretation.steps).toBe('complete')
  })

  it('keeps every diagnosis, and signup attaches an anonymous one (DIA-12, R-20)', async () => {
    const customer = await db.customer.create({ data: { email: 'dx@mail.com' } })
    const a = await dx.diagnoseAndSave(db, answers(), { customerId: customer.id })
    const b = await dx.diagnoseAndSave(db, answers())
    await dx.attachDiagnosis(db, b.code, customer.id)
    const mine = await db.diagnosis.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } })
    expect(mine.map((d) => d.code)).toEqual([a.code, b.code])
  })

  it('her routine goes into the cart in one action with the routine discount (R-18, R-19)', async () => {
    const { code, result } = await dx.diagnoseAndSave(db, answers())
    const { cartId, newToken } = await ensureCart(db, null, null)
    const added = await addDiagnosisToCart(db, cartId, { code, scope: 'full' })
    expect(added!.added).toBe(result.productIds.length) // a product of morning and night goes in once
    const view = await viewCart(db, await findCart(db, newToken))
    expect(view.routines[0]).toMatchObject({ name: 'Tu rutina del diagnóstico', scope: 'full', discountPct: 10 })
    expect(view.pricing.routineDiscountCents).toBeGreaterThan(0)
  })

  it('emails the routine; the newsletter only with its own box (EM-13, R-21)', async () => {
    const { code } = await dx.diagnoseAndSave(db, answers())
    expect(await dx.emailRoutine(db, code, 'no@mail', false)).toEqual({ ok: false, error: 'Ingresá un email válido.' })
    expect(await dx.emailRoutine(db, code, 'Lu@Mail.com', false)).toEqual({ ok: true })
    const m = await db.emailMessage.findFirstOrThrow({ where: { template: 'routine_email', to: 'lu@mail.com' } })
    expect(m.subject).toBe('Tu rutina de mañana y de noche')
    expect(m.text).toContain('De mañana')
    expect(await db.newsletterSubscriber.count({ where: { email: 'lu@mail.com' } })).toBe(0)
    await dx.emailRoutine(db, code, 'lu@mail.com', true)
    expect(await db.newsletterSubscriber.count({ where: { email: 'lu@mail.com' } })).toBe(1)
  })
})
