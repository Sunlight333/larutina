// CAT-02 round trip (03 §3.7): import → export → import the export back.
// The second import must validate with no errors and no price changes,
// create nothing, and leave the database exactly as it was.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { importCatalog, type ImportReport } from '../../src/server/catalog-import'
import { exportRows, toXlsx } from '../../src/server/catalog-export'
import { readWorkbook } from '../../src/server/catalog-import/workbook'
import { baseCatalog, product, toXlsx as fixtureXlsx, variant, type FixtureRows } from '../support/catalog-fixture'
import { catalogSnapshot, samplePath } from '../support/catalog-snapshot'

const db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })

beforeEach(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE brands, categories, concerns, skin_types, ingredient_families, ingredients, products, routines, evaluation_criteria, endorsements, synonyms, knowledge_entries, import_jobs CASCADE`,
  )
})
afterAll(async () => {
  await db.$disconnect()
})

/** The base fixture plus every optional sheet and every kind of value the template has. */
function fullCatalog(): FixtureRows {
  const rows = baseCatalog()
  rows.Marcas![0] = { ...rows.Marcas![0]!, pais_origen: 'Corea del Sur', descripcion: 'Marca de prueba.', logo_archivo: 'marca-a.png' }
  rows.Productos![0] = {
    ...rows.Productos![0]!,
    inci: 'Water, Niacinamide, Glycerin, Retinol',
    frase_principal: 'Calma y repara sin perfume',
    chips: 'Piel sensible | Barrera',
    etiquetas: 'Edición limitada',
    vegano: 'Sí',
    cruelty_free: 'No',
    alicuota_iva: '10.5',
    nivel: 'Intermedio',
    prioridad: '2',
    linea: 'Línea A',
    pao_meses: '12',
    compatibles: 'ma-gel',
    alternativas: 'ma-kit',
  }
  rows.Productos!.push(
    product('ma-kit', { tipo: 'Kit', contenido_kit: 'MA-SER-30; MA-GEL-150', imagenes: 'kit_1.jpg; kit_2.jpg' }),
    product('ma-serum-mini', { tipo: 'Tamaño de viaje', producto_base: 'ma-serum' }),
  )
  rows.Variantes = [
    variant('MA-SER-30', 'ma-serum', { variante_principal: 'Sí', precio_promocional_ars: '15900', costo_ars: '9000', codigo_barras: '7790001234567', alto_cm: '12.5', peso_g: '80' }),
    variant('MA-SER-50', 'ma-serum', { tamano: '50', precio_ars: '25900,50' }),
    variant('MA-GEL-150', 'ma-gel', { precio_ars: '9900', variante_principal: 'Sí', unidad: 'g' }),
    variant('MA-KIT-1', 'ma-kit', { tamano: '2', unidad: 'unidades', precio_ars: '26000' }),
    variant('MA-SER-MINI', 'ma-serum-mini', { tamano: '10', precio_ars: '7000' }),
  ]
  rows.Prod_Ingredientes!.push({ codigo_producto: 'ma-serum', codigo_ingrediente: 'retinol', orden_inci: '4', es_activo_clave: 'No', concentracion: '0,1%' })
  rows.Conflictos = [{ ingrediente_a: 'retinol', ingrediente_b: 'niacinamida', severidad: 'Con precaución', nota: 'Mejor separados.' }]
  rows.Conflictos_Familias = [{ familia_a: 'retinoide', familia_b: 'fragancia', severidad: 'Evitar' }]
  rows.Criterios = [{ codigo_criterio: 'eficacia', nombre: 'Eficacia', peso: '2.5' }]
  rows.Evaluacion = [{ codigo_producto: 'ma-serum', codigo_criterio: 'eficacia', puntaje: '90', nota: 'Muy buena.' }]
  rows.Avales = [{ codigo_producto: 'ma-serum', entidad: 'Dermatóloga X', tipo: 'Producto', activo: 'No' }]
  rows.Base_Conocimiento = [{ codigo: 'envios', categoria: 'Envíos', pregunta: '¿Envían?', respuesta: 'Sí.', palabras_clave: 'envío; correo', activa: 'Sí' }]
  rows.Sinonimos = [{ termino: 'Grasa', tipo: 'Tipo de piel', codigo_destino: 'grasa', sinonimos: 'oleosa; con brillo' }]
  rows.Rutinas![0] = { ...rows.Rutinas![0]!, dificultad: 'Básica', descuento_pct: '10' }
  return rows
}

const nonInfo = (r: ImportReport) => r.issues.filter((i) => i.level !== 'info')
const priceWarnings = (r: ImportReport) => r.issues.filter((i) => i.field === 'precio_ars' && i.level === 'warning')
const created = (r: ImportReport) => Object.entries(r.counts).filter(([sheet, c]) => c.created > 0 && sheet !== 'Avales')

async function roundTrip(includeCost: boolean) {
  const before = await catalogSnapshot(db)
  const file = await toXlsx(await exportRows(db, { includeCost }), { includeCost })

  const dry = await importCatalog(db, { name: 'export.xlsx', data: file }, { dryRun: true })
  expect(dry.issues.filter((i) => i.level === 'error')).toEqual([])
  expect(dry.status).toBe('VALIDATED')
  expect(priceWarnings(dry)).toEqual([])
  expect(dry.issues.filter((i) => i.message.startsWith('Ingrediente nuevo'))).toEqual([])
  expect(await catalogSnapshot(db)).toEqual(before)

  const applied = await importCatalog(db, { name: 'export.xlsx', data: file })
  expect(applied.status).toBe('APPLIED')
  expect(created(applied)).toEqual([])
  expect(await catalogSnapshot(db)).toEqual(before)
  return { file, dry, applied }
}

describe('catalog export', () => {
  it('writes the template layout: Leame, Diccionario, the 19 sheets in order, Listas', async () => {
    await importCatalog(db, { name: 'f.xlsx', data: await fixtureXlsx(fullCatalog()) })
    const file = await toXlsx(await exportRows(db, { includeCost: false }), { includeCost: false })
    const wb = await readWorkbook(file)
    expect([...wb.keys()]).toEqual([
      'Leame',
      'Diccionario',
      'Marcas',
      'Categorias',
      'Necesidades',
      'TiposDePiel',
      'Familias',
      'Ingredientes',
      'Conflictos',
      'Conflictos_Familias',
      'Productos',
      'Criterios',
      'Evaluacion',
      'Variantes',
      'Prod_Ingredientes',
      'Prod_Necesidades',
      'Prod_TiposPiel',
      'Rutinas',
      'Pasos_Rutina',
      'Avales',
      'Base_Conocimiento',
      'Sinonimos',
      'Listas',
    ])
    expect(wb.get('Variantes')!.headers).not.toContain('costo_ars')
    const serum = wb.get('Productos')!.rows.find((r) => r.cells['codigo_producto'] === 'ma-serum')!.cells
    expect(serum).toMatchObject({ estado: 'Borrador', paso_rutina: 'Sérum', momento: 'PM', chips: 'Piel sensible | Barrera', vegano: 'Sí', testeado_dermatologicamente: 'Sin dato', alicuota_iva: '10.5' })
    expect(wb.get('Variantes')!.rows.map((r) => r.cells['sku'])).toEqual(['MA-SER-30', 'MA-SER-50', 'MA-GEL-150', 'MA-KIT-1', 'MA-SER-MINI'])
    // With the INCI text, only star rows and concentrations go to Prod_Ingredientes (CAT-19).
    expect(wb.get('Prod_Ingredientes')!.rows.map((r) => [r.cells['codigo_producto'], r.cells['codigo_ingrediente']])).toEqual([
      ['ma-serum', 'niacinamida'],
      ['ma-serum', 'retinol'],
    ])
    // Ingredients created from an INCI list and still to review are not in the sheet: the INCI recreates them.
    expect(wb.get('Ingredientes')!.rows.map((r) => r.cells['codigo_ingrediente'])).not.toContain('glycerin')
  })

  it('round-trips the fixture: no errors, no price changes, nothing created, nothing changed', async () => {
    const first = await importCatalog(db, { name: 'f.xlsx', data: await fixtureXlsx(fullCatalog()) })
    expect(first.errors).toBe(0)
    // What the panel changes after the import is kept too.
    await db.product.update({ where: { code: 'ma-serum' }, data: { status: 'ACTIVE', presaleDate: new Date('2027-01-20'), manualOrder: 3 } })
    await db.productVariant.update({ where: { sku: 'MA-GEL-150' }, data: { stock: 42 } })

    const { file } = await roundTrip(true)
    // A second export is the same as the first.
    const again = await toXlsx(await exportRows(db, { includeCost: true }), { includeCost: true })
    const [a, b] = await Promise.all([readWorkbook(file), readWorkbook(again)])
    for (const name of a.keys()) if (name !== 'Leame') expect(b.get(name)!.rows).toEqual(a.get(name)!.rows)
  })

  it('without the cost column (a role without cost), keeps the stored costs', async () => {
    await importCatalog(db, { name: 'f.xlsx', data: await fixtureXlsx(fullCatalog()) })
    const { dry } = await roundTrip(false)
    expect(dry.issues).toContainEqual(expect.objectContaining({ level: 'info', sheet: 'Variantes', field: 'costo_ars' }))
    expect((await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-SER-30' } })).costCents).toBe(900_000)
  })

  it('ignores cost in a file imported by a role without cost', async () => {
    await importCatalog(db, { name: 'f.xlsx', data: await fixtureXlsx(fullCatalog()) })
    const rows = fullCatalog()
    rows.Variantes![0]!.costo_ars = '1'
    const report = await importCatalog(db, { name: 'f.xlsx', data: await fixtureXlsx(rows) }, { ignoreCost: true })
    expect(report.status).toBe('APPLIED')
    expect((await db.productVariant.findUniqueOrThrow({ where: { sku: 'MA-SER-30' } })).costCents).toBe(900_000)
  })
})

const SAMPLE = samplePath()

describe.skipIf(!SAMPLE)("client's v1.1 sample round trip", () => {
  it('exports the sample and imports it back without changing anything', async () => {
    const first = await importCatalog(db, { name: path.basename(SAMPLE!), data: readFileSync(SAMPLE!) })
    expect(nonInfo(first)).toEqual([])
    const { dry } = await roundTrip(true)
    expect(nonInfo(dry)).toEqual([])
  })
})
