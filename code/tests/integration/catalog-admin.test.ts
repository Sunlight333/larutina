// The panel's catalog services against PostgreSQL: the draft rule (ADM-02),
// INCI edits (CAT-08, CAT-19), variants and taxonomies (CAT-22, CAT-01), and
// bulk updates (CAT-04: 50 price changes in one operation with a preview).
import ExcelJS from 'exceljs'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { importCatalog } from '../../src/server/catalog-import'
import { applyChanges, parseChanges, previewPercent, previewSheet, previewStatus, readBulkFile } from '../../src/server/services/admin/catalog/bulk'
import { saveIngredient, setIngredientStatus } from '../../src/server/services/admin/catalog/ingredients'
import { saveProductIngredients } from '../../src/server/services/admin/catalog/product-ingredients'
import { saveProductConcerns, saveProductRelations } from '../../src/server/services/admin/catalog/product-links'
import { dataOf } from '../../src/server/services/admin/catalog/product-fields'
import { bulkSetStatus, createProduct, deleteProduct, discardDraft, publishDraft, publishProduct, saveProductData, setProductStatus } from '../../src/server/services/admin/catalog/products'
import { saveSynonym } from '../../src/server/services/admin/catalog/synonyms'
import { deleteBrand, deleteCategory, saveBrand, saveCategory, saveConcern } from '../../src/server/services/admin/catalog/taxonomies'
import { createVariant, deleteVariant, updateVariant } from '../../src/server/services/admin/catalog/variants'
import { baseCatalog, toXlsx, variant } from '../support/catalog-fixture'

const db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
const actor = { id: 'test-admin', email: 'admin@example.test' }
const opts = { dermatologistLabelEnabled: false }

beforeEach(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs, audit_logs CASCADE`,
  )
  const report = await importCatalog(db, { name: 'f.xlsx', data: await toXlsx(baseCatalog()) })
  expect(report.status).toBe('APPLIED')
})
afterAll(async () => {
  await db.$disconnect()
})

/** The "Datos" form as the panel posts it, from the product's current values. */
async function formOf(code: string): Promise<Record<string, string | string[]>> {
  const p = await db.product.findUniqueOrThrow({ where: { code } })
  const out: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(dataOf(p))) {
    if (k === 'baseProductId') out[k] = ''
    else if (k === 'labels') out[k] = v as string[]
    else if (Array.isArray(v)) out[k] = v.join('\n')
    else out[k] = v === null ? '' : String(v)
  }
  return out
}

describe('product draft rule (ADM-02)', () => {
  it('edits a product in draft in place, then publishes it with publishedAt', async () => {
    const form = { ...(await formOf('ma-serum')), headline: 'Calma y repara sin perfume' }
    expect(await saveProductData(db, actor, 'ma-serum', form, opts)).toMatchObject({ ok: true })
    let p = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    expect(p.headline).toBe('Calma y repara sin perfume')
    expect(p.draft).toBeNull()

    expect(await publishProduct(db, actor, 'ma-serum')).toMatchObject({ ok: true, message: 'Publicado como Activo.' })
    p = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    expect(p.status).toBe('ACTIVE')
    expect(p.publishedAt).not.toBeNull()
    const log = await db.auditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: 'asc' } })
    expect(log.map((l) => l.action)).toEqual(['update', 'publish'])
    expect(log[0]!.after).toEqual({ headline: 'Calma y repara sin perfume' })
  })

  it('keeps edits of a published product in the draft until "Publicar cambios"', async () => {
    await publishProduct(db, actor, 'ma-serum')
    const form = { ...(await formOf('ma-serum')), name: 'Sérum nuevo', presaleDate: '2027-01-20', vatRate: '10,5' }
    const saved = await saveProductData(db, actor, 'ma-serum', form, opts)
    expect(saved).toMatchObject({ ok: true })
    let p = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    expect(p.name).toBe('Producto ma-serum')
    expect(p.draft).toEqual({ name: 'Sérum nuevo', presaleDate: '2027-01-20', vatRate: 10.5 })

    expect(await publishDraft(db, actor, 'ma-serum')).toMatchObject({ ok: true })
    p = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })
    expect(p.name).toBe('Sérum nuevo')
    expect(p.presaleDate?.toISOString().slice(0, 10)).toBe('2027-01-20')
    expect(Number(p.vatRate)).toBe(10.5)
    expect(p.draft).toBeNull()
    const publish = await db.auditLog.findFirstOrThrow({ where: { entityId: p.id, action: 'publish' }, orderBy: { createdAt: 'desc' } })
    expect(publish.before).toEqual({ name: 'Producto ma-serum', presaleDate: null, vatRate: null })

    await saveProductData(db, actor, 'ma-serum', { ...(await formOf('ma-serum')), name: 'Otro' }, opts)
    expect(await discardDraft(db, actor, 'ma-serum')).toMatchObject({ ok: true })
    expect((await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })).name).toBe('Sérum nuevo')
  })

  it('applies the import rules with the import messages', async () => {
    const form = { ...(await formOf('ma-serum')), headline: 'una dos tres cuatro cinco seis siete ocho nueve', chips: 'uno\ndos\ntres\ncuatro', evaluationScore: '' }
    const r = await saveProductData(db, actor, 'ma-serum', form, opts)
    expect(r.ok).toBe(false)
    expect(r.fieldErrors).toMatchObject({ headline: 'Tiene 9 palabras; el máximo es 8.', chips: 'Tiene 4 chips; el máximo es 3.', evaluationScore: 'Campo obligatorio.' })
  })

  it('publishes as Preventa with an arrival date, and refuses to publish without images', async () => {
    await saveProductData(db, actor, 'ma-gel', { ...(await formOf('ma-gel')), presaleDate: '2027-02-01' }, opts)
    expect(await publishProduct(db, actor, 'ma-gel')).toMatchObject({ ok: true, message: 'Publicado como Preventa.' })
    await db.product.update({ where: { code: 'ma-serum' }, data: { images: [] } })
    const r = await setProductStatus(db, actor, 'ma-serum', 'ACTIVE')
    expect(r).toMatchObject({ ok: false, message: 'Antes de publicarlo falta: Al menos una imagen.' })
  })

  it('changes the status of several products at once and reports the ones that cannot', async () => {
    await db.product.update({ where: { code: 'ma-gel' }, data: { images: [] } })
    const ids = (await db.product.findMany({ select: { id: true } })).map((p) => p.id)
    const r = await bulkSetStatus(db, actor, ids, 'ACTIVE')
    expect(r.message).toContain('1 producto pasó a Activo.')
    expect(r.message).toContain('ma-gel')
    expect(await db.auditLog.count({ where: { action: 'bulk.status' } })).toBe(1)
  })

  it('creates a product in draft with its first variant, and sends it to the trash', async () => {
    const form = { ...(await formOf('ma-serum')), code: 'ma-nuevo', sku: 'MA-NUEVO-1', size: '50', unit: 'ML', priceCents: '12000', stock: '3' }
    const r = await createProduct(db, actor, form, { canCost: false, dermatologistLabelEnabled: false })
    expect(r).toMatchObject({ ok: true, code: 'ma-nuevo' })
    const p = await db.product.findUniqueOrThrow({ where: { code: 'ma-nuevo' }, include: { variants: true } })
    expect(p.status).toBe('DRAFT')
    expect(p.variants).toMatchObject([{ sku: 'MA-NUEVO-1', priceCents: 1_200_000, isMain: true }])
    expect((await createProduct(db, actor, { ...form, sku: 'X-2' }, { canCost: false, dermatologistLabelEnabled: false })).fieldErrors?.code).toMatch(/ya existe/)
    expect(await deleteProduct(db, actor, 'ma-nuevo')).toMatchObject({ ok: true })
    expect((await db.product.findUniqueOrThrow({ where: { code: 'ma-nuevo' } })).deletedAt).not.toBeNull()
    // In a routine: refused.
    expect(await deleteProduct(db, actor, 'ma-gel')).toMatchObject({ ok: false })
  })
})

describe('ingredients from the panel (CAT-08, CAT-19)', () => {
  it('splits and matches the INCI like the import, creates unknown names to review and recomputes the flags', async () => {
    const r = await saveProductIngredients(db, actor, 'ma-serum', {
      inciText: 'Water, Niacinamide, Parfum (Fragrance), Squalane',
      stars: [{ code: 'niacinamida', isStar: true, concentration: '5%' }],
    })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('Nuevos para revisar: Squalane.')
    const p = await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' }, include: { ingredients: { orderBy: { inciOrder: 'asc' }, include: { ingredient: true } } } })
    expect(p.ingredients.map((i) => [i.ingredient.code, i.isStar, i.concentration])).toEqual([
      ['agua', false, null],
      ['niacinamida', true, '5%'],
      ['perfume', false, null],
      ['squalane', false, null],
    ])
    expect(p.fragranceFree).toBe(false)
    expect(p.containsRetinoid).toBe(false)
    expect((await db.ingredient.findUniqueOrThrow({ where: { code: 'squalane' } })).status).toBe('REVIEW')
  })

  it('recomputes the flags of the products when an ingredient changes family', async () => {
    const retinoide = await db.ingredientFamily.findUniqueOrThrow({ where: { code: 'retinoide' } })
    const agua = await db.ingredient.findUniqueOrThrow({ where: { code: 'agua' } })
    const r = await saveIngredient(db, actor, 'agua', { commonName: 'Agua', inciName: 'Water', familyId: retinoide.id, isKeyActive: '', isIrritant: '', description: '' })
    expect(r.message).toContain('Se recalcularon los indicadores de 2 productos.')
    expect((await db.product.findUniqueOrThrow({ where: { code: 'ma-gel' } })).containsRetinoid).toBe(true)
    expect(agua.familyId).toBeNull()
  })

  it('refuses a second ingredient with the same INCI name, and marks one as reviewed', async () => {
    const r = await saveIngredient(db, actor, null, { code: 'agua-2', commonName: 'Agua', inciName: 'water', isKeyActive: '', isIrritant: '' })
    expect(r.fieldErrors?.inciName).toMatch(/"agua"/)
    await saveProductIngredients(db, actor, 'ma-gel', { inciText: 'Water, Glycerin', stars: [] })
    expect(await setIngredientStatus(db, actor, 'glycerin', 'ACTIVE')).toMatchObject({ ok: true, message: 'Marcado como revisado.' })
  })
})

describe('variants and links', () => {
  it('keeps one main variant, promo below price and the SKU fixed', async () => {
    const base = { size: '50', unit: 'ML', priceCents: '20000', stock: '1', isMain: 'on' }
    expect((await createVariant(db, actor, 'ma-serum', 'MA-SER-50', { ...base, promoPriceCents: '20000' }, false)).fieldErrors?.promoPriceCents).toBe(
      'El precio promocional (20000) tiene que ser menor al precio (20000).',
    )
    expect((await createVariant(db, actor, 'ma-serum', 'MA-SER-50', { ...base, priceCents: '18.900' }, false)).fieldErrors?.priceCents).toBe(
      '"18.900": cargá el precio sin puntos ni símbolos (por ejemplo 18900).',
    )
    expect(await createVariant(db, actor, 'ma-serum', 'MA-SER-50', base, false)).toMatchObject({ ok: true })
    const variants = await db.productVariant.findMany({ where: { product: { code: 'ma-serum' } }, orderBy: { sku: 'asc' } })
    expect(variants.map((v) => [v.sku, v.isMain])).toEqual([
      ['MA-SER-30', false],
      ['MA-SER-50', true],
    ])
    expect((await updateVariant(db, actor, 'MA-SER-50', { ...base, isMain: '' }, false)).fieldErrors?.isMain).toMatch(/principal/)
    expect(await deleteVariant(db, actor, 'MA-SER-50', false)).toMatchObject({ ok: false })
    expect(await deleteVariant(db, actor, 'MA-SER-30', false)).toMatchObject({ ok: true })
    // Cost is not touched by a role without it.
    await db.productVariant.update({ where: { sku: 'MA-SER-50' }, data: { costCents: 500_000 } })
    await updateVariant(db, actor, 'MA-SER-50', { ...base, stock: '9', costCents: '1' }, false)
    expect(await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-SER-50' } })).toMatchObject({ stock: 9, costCents: 500_000 })
  })

  it('validates relevances and related codes', async () => {
    const manchas = await db.concern.findUniqueOrThrow({ where: { code: 'manchas' } })
    expect((await saveProductConcerns(db, actor, 'ma-serum', [{ concernId: manchas.id, relevance: '120' }])).fieldErrors).toEqual({ [`relevance.${manchas.id}`]: 'Un número entero de 0 a 100.' })
    expect(await saveProductConcerns(db, actor, 'ma-serum', [{ concernId: manchas.id, relevance: '90' }])).toMatchObject({ ok: true })
    const r = await saveProductRelations(db, actor, 'ma-serum', { COMPLEMENTARY: ['ma-gel'], COMPATIBLE: ['ma-serum'], ALTERNATIVE: ['no-existe'] })
    expect(r.fieldErrors).toEqual({ COMPATIBLE: 'Un producto no puede relacionarse consigo mismo.', ALTERNATIVE: 'No existen: no-existe.' })
  })
})

describe('taxonomies (CAT-01)', () => {
  it('sets codes once, in kebab-case, never reused, and blocks deleting what live products use', async () => {
    expect((await saveBrand(db, actor, null, { code: 'Marca B', name: 'B' })).fieldErrors?.code).toMatch(/no es un código válido/)
    expect((await saveBrand(db, actor, null, { code: 'marca-a', name: 'B' })).fieldErrors?.code).toMatch(/ya existe/)
    expect(await saveBrand(db, actor, null, { code: 'marca-b', name: 'B' })).toMatchObject({ ok: true, code: 'marca-b' })
    expect(await deleteBrand(db, actor, 'marca-a')).toMatchObject({ ok: false, message: 'No se puede borrar: la usan 2 productos. Cambiales la marca o borralos antes.' })
    expect(await deleteBrand(db, actor, 'marca-b')).toMatchObject({ ok: true })
    expect((await saveBrand(db, actor, null, { code: 'marca-b', name: 'B' })).fieldErrors?.code).toMatch(/ya existe/)
  })

  it('checks categories and needs with the template rules', async () => {
    const serums = await db.category.findUniqueOrThrow({ where: { code: 'serums' } })
    expect((await saveCategory(db, actor, 'tratamiento', { name: 'Tratamiento', parentId: serums.id })).fieldErrors?.parentId).toMatch(/dentro de sí misma/)
    expect((await saveCategory(db, actor, 'tratamiento', { name: 'Tratamiento', sortOrder: '0' })).fieldErrors?.sortOrder).toBe('0 es menor que el mínimo (1).')
    expect(await deleteCategory(db, actor, 'tratamiento')).toMatchObject({ ok: false })
    expect((await saveConcern(db, actor, null, { code: 'acne', name: 'Acné', shortLabel: 'Una etiqueta demasiado larga' })).fieldErrors?.shortLabel).toBe('Tiene 28 caracteres; el máximo es 18.')
    expect((await saveSynonym(db, actor, null, { term: 'Oleosa', type: 'SKIN_TYPE', targetCode: 'mixta', variants: 'brillo' })).fieldErrors?.targetCode).toMatch(/no existe/)
    expect(await saveSynonym(db, actor, null, { term: 'Oleosa', type: 'SKIN_TYPE', targetCode: 'grasa', variants: 'brillo\ncon brillo' })).toMatchObject({ ok: true })
  })
})

describe('bulk updates (CAT-04)', () => {
  async function withFiftyVariants() {
    const rows = baseCatalog()
    rows.Variantes = [variant('MA-GEL-150', 'ma-gel', { variante_principal: 'Sí' })]
    for (let i = 1; i <= 50; i++) rows.Variantes.push(variant(`MA-SER-L${i}`, 'ma-serum', { precio_ars: String(10000 + i), variante_principal: i === 1 ? 'Sí' : 'No' }))
    expect((await importCatalog(db, { name: 'f.xlsx', data: await toXlsx(rows) })).status).toBe('APPLIED')
  }

  async function sheet(rows: (string | number | null)[][]) {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Precios')
    for (const r of rows) ws.addRow(r)
    return new Uint8Array(await wb.xlsx.writeBuffer())
  }

  it('applies a sheet with 50 price changes in one operation, after a preview', async () => {
    await withFiftyVariants()
    const data = await sheet([['sku', 'precio_ars'], ...Array.from({ length: 50 }, (_, i) => [`MA-SER-L${i + 1}`, 20000 + i])])
    const read = await readBulkFile('precios.xlsx', data)
    if ('error' in read) throw new Error(read.error)
    const preview = await previewSheet(db, read.rows)
    expect(preview.errors).toEqual([])
    expect(preview.changes).toHaveLength(50)
    expect(preview.changes[0]).toMatchObject({ kind: 'variant', sku: 'MA-SER-L1', price: { from: 1_000_100, to: 2_000_000 } })
    // Nothing changes until it is applied.
    expect((await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-SER-L1' } })).priceCents).toBe(1_000_100)

    const changes = parseChanges(JSON.stringify(preview.changes))!
    expect(await applyChanges(db, actor, changes)).toMatchObject({ ok: true, message: 'Listo: 50 cambios aplicados.' })
    const prices = await db.productVariant.findMany({ where: { sku: { startsWith: 'MA-SER-L' } }, orderBy: { priceCents: 'asc' } })
    expect(prices.map((v) => v.priceCents)).toEqual(Array.from({ length: 50 }, (_, i) => (20000 + i) * 100))
    expect(await db.auditLog.count({ where: { action: 'bulk.update' } })).toBe(50)

    // Applying the same preview again finds the values moved: nothing is applied.
    expect(await applyChanges(db, actor, changes)).toMatchObject({ ok: false })
  })

  it('reports every problem per row and applies nothing while there are errors', async () => {
    const csv = ['sku;precio_ars;precio_promocional_ars;stock;estado', 'NO-EXISTE;100;;;', 'MA-SER-30;18.900;;;', 'MA-GEL-150;9000;9500;;', 'MA-GEL-150;1;;;', 'MA-SER-30;;;muchos;', 'MA-SER-30;;;;Vendido'].join('\r\n')
    const read = await readBulkFile('lote.csv', new TextEncoder().encode(csv))
    if ('error' in read) throw new Error(read.error)
    const preview = await previewSheet(db, read.rows)
    expect(preview.errors.map((e) => [e.row, e.message])).toEqual([
      [2, 'El SKU no existe.'],
      [3, 'precio_ars: "18.900": cargá el precio sin puntos ni símbolos (por ejemplo 18900).'],
      [4, 'precio_promocional_ars: El precio promocional (9500) tiene que ser menor al precio (9000).'],
      [5, 'SKU repetido: ya está en la fila 4.'],
      [6, 'SKU repetido: ya está en la fila 3.'],
      [7, 'SKU repetido: ya está en la fila 3.'],
    ])
  })

  it('previews and applies stock, promo removal and status from a sheet', async () => {
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { promoPriceCents: 1_500_000 } })
    const read = await readBulkFile('lote.csv', new TextEncoder().encode('sku,precio_promocional_ars,stock,estado\nMA-SER-30,0,7,Activo\nMA-GEL-150,,,'))
    if ('error' in read) throw new Error(read.error)
    const preview = await previewSheet(db, read.rows)
    expect(preview.errors).toEqual([])
    expect(preview.unchanged).toBe(1)
    expect(preview.changes).toMatchObject([
      { kind: 'variant', sku: 'MA-SER-30', promo: { from: 1_500_000, to: null }, stock: { from: 5, to: 7 } },
      { kind: 'status', productCode: 'ma-serum', status: { from: 'DRAFT', to: 'ACTIVE' } },
    ])
    expect(await applyChanges(db, actor, preview.changes)).toMatchObject({ ok: true })
    expect(await db.product.findUniqueOrThrow({ where: { code: 'ma-serum' } })).toMatchObject({ status: 'ACTIVE' })
    expect(await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-SER-30' } })).toMatchObject({ promoPriceCents: null, stock: 7 })
  })

  it('changes prices by a percentage for a filter, rounded to whole pesos', async () => {
    await db.productVariant.update({ where: { sku: 'MA-SER-30' }, data: { promoPriceCents: 1_500_050 } })
    const preview = await previewPercent(db, { brand: 'marca-a', category: 'serums' }, 7.5)
    expect(preview.changes).toEqual([
      { kind: 'variant', sku: 'MA-SER-30', productCode: 'ma-serum', productName: 'Producto ma-serum', price: { from: 1_890_000, to: 2_031_800 }, promo: { from: 1_500_050, to: 1_612_600 } },
    ])
    expect(await applyChanges(db, actor, preview.changes)).toMatchObject({ ok: true, message: 'Listo: 2 cambios aplicados.' })
    const status = await previewStatus(db, { brand: 'marca-a' }, 'ARCHIVED')
    expect(status.changes).toHaveLength(2)
  })
})
