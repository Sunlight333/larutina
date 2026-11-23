// The whole import path against PostgreSQL: file → validation → one
// transaction. Proves the CAT-02 acceptance: a file with one error reports
// row and field and changes nothing.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { baseCatalog, toXlsx } from '../support/catalog-fixture'
import { samplePath } from '../support/catalog-snapshot'

let db: PrismaClient

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  // Each run starts from an empty catalog.
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs CASCADE`,
  )
})
afterAll(async () => {
  await db.$disconnect()
})

const snapshot = async () => ({
  products: await db.product.count(),
  variants: await db.productVariant.findMany({ select: { sku: true, priceCents: true }, orderBy: { sku: 'asc' } }),
  ingredients: await db.productIngredient.count(),
  steps: await db.routineStep.count(),
})

describe('catalog import', () => {
  it('imports a valid file in one go, with products in draft', async () => {
    const report = await importCatalog(db, { name: 'catalogo.xlsx', data: await toXlsx(baseCatalog()) })
    expect(report.status).toBe('APPLIED')
    expect(report.errors).toBe(0)
    expect(report.counts['Productos']).toEqual({ created: 2, updated: 0 })

    const serum = await db.product.findUniqueOrThrow({
      where: { code: 'ma-serum' },
      include: { ingredients: { include: { ingredient: true }, orderBy: { inciOrder: 'asc' } }, variants: true, category: { include: { parent: true } } },
    })
    expect(serum.status).toBe('DRAFT')
    expect(serum.containsRetinoid).toBe(true)
    expect(serum.ingredients.map((i) => [i.ingredient.code, i.isStar])).toEqual([
      ['agua', false],
      ['niacinamida', true],
      ['retinol', false],
    ])
    expect(serum.variants[0]).toMatchObject({ sku: 'MA-SER-30', priceCents: 1_890_000, isMain: true })
    expect(serum.category.parent?.code).toBe('tratamiento')
    expect(await db.routineStep.count()).toBe(2)
  })

  it('rejects a file with one error, reports row and field, and changes nothing', async () => {
    const before = await snapshot()
    const rows = baseCatalog()
    rows.Variantes![0]!.precio_ars = '25000'
    rows.Variantes![1]!.stock = 'muchos'
    const report = await importCatalog(db, { name: 'con-error.xlsx', data: await toXlsx(rows) })

    expect(report.status).toBe('REJECTED')
    expect(report.issues.filter((i) => i.level === 'error')).toEqual([
      { level: 'error', sheet: 'Variantes', row: 3, field: 'stock', message: '"muchos" no es un número.' },
    ])
    expect(await snapshot()).toEqual(before)
    const job = await db.importJob.findUniqueOrThrow({ where: { id: report.jobId } })
    expect(job.status).toBe('REJECTED')
  })

  it('re-imports the same file without creating anything, and keeps a published status', async () => {
    await db.product.update({ where: { code: 'ma-serum' }, data: { status: 'ACTIVE' } })
    const report = await importCatalog(db, { name: 'catalogo.xlsx', data: await toXlsx(baseCatalog()) })
    expect(report.status).toBe('APPLIED')
    expect(report.counts['Productos']).toEqual({ created: 0, updated: 2 })
    expect(report.counts['Variantes']).toEqual({ created: 0, updated: 2 })
    expect((await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })).status).toBe('ACTIVE')
    expect(await db.productIngredient.count()).toBe(5)
  })

  it('warns about a price change and applies it', async () => {
    const rows = baseCatalog()
    rows.Variantes![1]!.precio_ars = '10890'
    const report = await importCatalog(db, { name: 'precios.xlsx', data: await toXlsx(rows) })
    expect(report.status).toBe('APPLIED')
    expect(report.issues).toContainEqual(expect.objectContaining({ level: 'warning', sheet: 'Variantes', row: 3, field: 'precio_ars', message: 'El precio cambia de 9900 a 10890 (+10%).' }))
    expect((await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-GEL-150' } })).priceCents).toBe(1_089_000)
  })

  it('validates without writing in a dry run', async () => {
    const rows = baseCatalog()
    rows.Marcas!.push({ codigo_marca: 'marca-b', nombre: 'Marca B' })
    const report = await importCatalog(db, { name: 'prueba.xlsx', data: await toXlsx(rows) }, { dryRun: true })
    expect(report.status).toBe('VALIDATED')
    expect(await db.brand.findUnique({ where: { code: 'marca-b' } })).toBeNull()
  })
})

// The client's own sample: kept out of this public repository, so this runs
// only on a machine that has the project documents (or CATALOG_SAMPLE set).
const SAMPLE = samplePath()

describe.skipIf(!SAMPLE)("client's v1.1 sample", () => {
  it('imports with all relations and no errors (H0, CAT-01)', async () => {
    const report = await importCatalog(db, { name: path.basename(SAMPLE!), data: readFileSync(SAMPLE!) })
    expect(report.issues.filter((i) => i.level !== 'info')).toEqual([])
    expect(report.status).toBe('APPLIED')
    expect(report.counts['Productos']?.created).toBe(15)
    expect(report.counts['Variantes']?.created).toBe(16)
    expect(await db.productIngredient.count({ where: { product: { brand: { code: { in: ['purito', 'axis-y', 'arencia'] } } } } })).toBe(484)
  })
})
