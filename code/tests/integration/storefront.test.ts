// The storefront's catalog services against PostgreSQL: what is published,
// travel sizes inheriting from their base (CAT-07), precautions with family
// warnings (PDP-03), unit prices and durations (PDP-02, CAT-09), drafts and
// their preview (ADM-02), the cart API and the search index.
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'

// The services read the database through getDb(), which reads this variable on first use.
process.env.DATABASE_URL = inject('databaseUrl')

const { loadCatalog } = await import('../../src/server/services/catalog/catalog')
const { getProductDetail } = await import('../../src/server/services/catalog/product')
const { getCartItems } = await import('../../src/server/services/catalog/cart')
const { loadSearchData } = await import('../../src/server/search')
const { MemoryIndex } = await import('../../src/server/search/memory')
const { defaultSettings } = await import('../../src/server/settings/registry')

let db: PrismaClient
const visitor = { team: false, preview: false }
const team = { team: true, preview: false }

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, settings CASCADE`,
  )
  const report = await importCatalog(db, { name: 'catalogo.xlsx', data: await toXlsx(baseCatalog()) })
  expect(report.status).toBe('APPLIED')

  await db.ingredientFamily.update({ where: { code: 'retinoide' }, data: { warning: 'No recomendado durante el embarazo o la lactancia.' } })
  await db.product.updateMany({ data: { status: 'ACTIVE', publishedAt: new Date() } })
  const serum = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
  await db.product.update({ where: { id: serum.id }, data: { durationDays: 60, vatRate: 10.5, precautions: null, line: 'Línea A' } })
  await db.productVariant.create({ data: { sku: 'MA-SER-10', productId: serum.id, size: 10, unit: 'ML', priceCents: 900_000, stock: 0 } })
  await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { promoPriceCents: 1_500_000 } })

  // A travel size with no texts or ingredients of its own.
  await db.product.create({
    data: {
      code: 'ma-serum-mini',
      name: 'Producto ma-serum mini',
      brandId: serum.brandId,
      categoryId: serum.categoryId,
      status: 'ACTIVE',
      type: 'TRAVEL_SIZE',
      baseProductId: serum.id,
      shortDescription: '',
      description: '',
      whyWeChose: '',
      howToUse: '',
      texture: 'Fluido',
      routineStep: 'SERUM',
      moment: 'PM',
      publishedAt: new Date(),
      variants: { create: { sku: 'MA-MINI-5', size: 5, unit: 'ML', priceCents: 400_000, stock: 3, isMain: true } },
    },
  })
  // A draft, with pending edits on the published serum.
  await db.product.update({ where: { code: 'ma-gel' }, data: { status: 'DRAFT' } })
  await db.product.update({ where: { code: 'ma-serum' }, data: { draft: { name: 'Nombre nuevo', headline: 'Frase pendiente' } } })
})

afterAll(async () => {
  await db.$disconnect()
})

describe('published catalog', () => {
  it('lists published products only, with travel sizes inheriting their base', async () => {
    const catalog = await loadCatalog(db, defaultSettings())
    expect(catalog.map((p) => p.code).sort()).toEqual(['ma-serum', 'ma-serum-mini'])
    const mini = catalog.find((p) => p.code === 'ma-serum-mini')!
    expect(mini.concerns).toEqual([{ code: 'manchas', relevance: 80 }])
    expect(mini.skinTypes).toEqual([{ code: 'grasa', aptitude: 'IDEAL' }])
    const serum = catalog.find((p) => p.code === 'ma-serum')!
    expect(serum.main).toMatchObject({ sku: 'MA-SER-30', chargedCents: 1_500_000 })
    expect(serum.variants.map((v) => [v.sku, v.available])).toEqual([
      ['MA-SER-30', true],
      ['MA-SER-10', false],
    ])
  })
})

describe('product page', () => {
  it('computes prices, durations, precautions and chips from the catalog', async () => {
    const p = (await getProductDetail('ma-serum', visitor))!
    expect(p.name).toBe('Producto ma-serum')
    expect(p.banner).toBeNull()
    const [main, small] = p.variants
    // PDP-02 on the charged (promo) price, with the product's own VAT rate.
    expect(main).toMatchObject({ chargedCents: 1_500_000, unitPrice: { cents: 5_000_000, per: '100 ml' }, withoutTaxesCents: Math.round(1_500_000 / 1.105) })
    // CAT-09: the main size takes the product value, the small one a proportional estimate.
    expect(main!.durationDays).toBe(60)
    expect(small!.durationDays).toBe(20)
    expect(small!.available).toBe(false)
    // PDP-03: no own text → the generic one, plus the retinoid family warning.
    expect(p.precautions.text).toEqual([defaultSettings()['catalog.genericPrecautions']])
    expect(p.precautions.warnings).toContain('No recomendado durante el embarazo o la lactancia.')
    // CAT-13: size and step come on their own.
    expect(p.chips.slice(0, 2)).toEqual(['30 ml', 'Sérum'])
    expect(p.concerns).toEqual([{ code: 'manchas', name: 'Manchas y tono desparejo' }])
    expect(p.stars.map((s) => [s.code, s.concentration])).toEqual([['niacinamida', '10%']])
    expect(p.benefits[0]).toEqual({ verb: 'CALMÁ', text: 'baja las rojeces' })
    expect(p.jsonLd).not.toHaveProperty('aggregateRating')
  })

  it('shows a travel size with its base product data', async () => {
    const p = (await getProductDetail('ma-serum-mini', visitor))!
    expect(p.baseProduct).toEqual({ code: 'ma-serum', name: 'Producto ma-serum' })
    expect(p.shortDescription).toEqual(['Corta.'])
    expect(p.inci && 'items' in p.inci ? p.inci.items.map((i) => i.name) : []).toEqual(['Water', 'Niacinamide', 'Retinol'])
    expect(p.precautions.warnings).toContain('No recomendado durante el embarazo o la lactancia.')
  })

  it('hides drafts from visitors and shows them to the team with a banner', async () => {
    expect(await getProductDetail('ma-gel', visitor)).toBeNull()
    const p = (await getProductDetail('ma-gel', team))!
    expect(p.banner).toMatch(/^Borrador/)
    expect(p.published).toBe(false)
    expect(p.variants.every((v) => !v.available)).toBe(true)
  })

  it('previews pending edits for the team only', async () => {
    expect((await getProductDetail('ma-serum', visitor, { preview: true }))!.name).toBe('Producto ma-serum')
    const p = (await getProductDetail('ma-serum', team, { preview: true }))!
    expect(p.name).toBe('Nombre nuevo')
    expect(p.headline).toBe('Frase pendiente')
    expect(p.indexable).toBe(false)
  })
})

describe('cart prices', () => {
  it('returns current prices for published SKUs only', async () => {
    const items = await getCartItems(db, ['MA-SER-30', 'MA-GEL-150', 'MA-SER-10', 'NO-EXISTE'])
    expect(items.map((i) => [i.sku, i.chargedCents, i.available, i.maxQty]).sort()).toEqual([
      ['MA-SER-10', 900_000, false, 0],
      ['MA-SER-30', 1_500_000, true, 5],
    ])
  })
})

describe('search index from the database', () => {
  it('finds published products by name, ingredient and synonym', async () => {
    await db.synonym.create({ data: { term: 'Hiperpigmentación', type: 'CONCERN', targetCode: 'manchas', variants: ['tono desparejo'] } })
    const index = new MemoryIndex(await loadSearchData(db))
    expect(index.search('retinol').products.map((p) => p.code).sort()).toEqual(['ma-serum', 'ma-serum-mini'])
    expect(index.search('hiperpigmentacion').products.length).toBe(2)
    expect(index.search('ma-gel').products.map((p) => p.code)).not.toContain('ma-gel')
    expect(index.suggest('manch').seeAll).toEqual({ label: 'Ver todo para Manchas y tono desparejo', href: '/necesidad/manchas' })
  })
})
