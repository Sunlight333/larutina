import { describe, expect, it } from 'vitest'
import { inciCandidates, splitInci } from '../../src/server/catalog-import/inci'
import { emptyExisting, validateCatalog } from '../../src/server/catalog-import/validate'
import { baseCatalog, product, toWorkbook, variant, type FixtureRows } from '../support/catalog-fixture'

const validate = (rows: FixtureRows, stage: 'S1' | 'S5' = 'S1', existing = emptyExisting()) => validateCatalog(toWorkbook(rows), existing, stage)
const errors = (r: ReturnType<typeof validate>) => r.issues.filter((i) => i.level === 'error')
const warnings = (r: ReturnType<typeof validate>) => r.issues.filter((i) => i.level === 'warning')

describe('INCI lists', () => {
  it('splits on commas outside parentheses and keeps numbered names whole', () => {
    expect(splitInci('Water, 1,2-Hexanediol, Parfum (Fragrance), Ceramide NP (1,3-Diol), Tocopherol.')).toEqual([
      'Water',
      '1,2-Hexanediol',
      'Parfum (Fragrance)',
      'Ceramide NP (1,3-Diol)',
      'Tocopherol',
    ])
  })

  it('matches the usual alternative spellings', () => {
    expect(inciCandidates('Aqua (Water)')).toEqual(['aqua (water)', 'aqua', 'water'])
    expect(inciCandidates('Water/Aqua/Eau')).toEqual(['water/aqua/eau', 'water', 'aqua', 'eau'])
  })
})

describe('catalog validation', () => {
  it('accepts a complete small catalog', () => {
    const r = validate(baseCatalog())
    expect(errors(r)).toEqual([])
    expect(warnings(r)).toEqual([])
    expect(r.input.products).toHaveLength(2)
  })

  it('orders ingredients by the INCI list and marks stars from Prod_Ingredientes', () => {
    const serum = validate(baseCatalog()).input.products.find((p) => p.code === 'ma-serum')!
    expect(serum.ingredients).toEqual([
      { code: 'agua', inciOrder: 1, isStar: false, concentration: null },
      { code: 'niacinamida', inciOrder: 2, isStar: true, concentration: '10%' },
      { code: 'retinol', inciOrder: 3, isStar: false, concentration: null },
    ])
  })

  it('computes flags from the families and matches "Aqua (Water)" to Water', () => {
    const { input } = validate(baseCatalog())
    const serum = input.products.find((p) => p.code === 'ma-serum')!
    const gel = input.products.find((p) => p.code === 'ma-gel')!
    expect(serum.flags).toMatchObject({ containsRetinoid: true, fragranceFree: true })
    expect(gel.flags).toMatchObject({ containsRetinoid: false, fragranceFree: false })
    expect(gel.ingredients.map((i) => i.code)).toEqual(['agua', 'perfume'])
  })

  it('creates unknown INCI names as ingredients to review', () => {
    const rows = baseCatalog()
    rows.Productos![0]!.inci = 'Water, Niacinamide, Retinol, Squalane'
    const r = validate(rows)
    const created = r.input.ingredients.filter((i) => i.fromInci)
    expect(created.map((i) => i.code)).toEqual(['squalane'])
    expect(r.issues.some((i) => i.level === 'info' && i.field === 'squalane')).toBe(true)
  })

  it('reports a bad value with sheet, row and column', () => {
    const rows = baseCatalog()
    rows.Variantes![0]!.precio_ars = '18.900'
    expect(errors(validate(rows))).toEqual([
      { level: 'error', sheet: 'Variantes', row: 2, field: 'precio_ars', message: '"18.900": cargá el precio sin puntos ni símbolos (por ejemplo 18900).' },
    ])
  })

  it('accepts prices with up to two decimals', () => {
    const rows = baseCatalog()
    rows.Variantes![0]!.precio_ars = '18.9'
    rows.Variantes![1]!.precio_ars = '9900,55'
    const r = validate(rows)
    expect(errors(r)).toEqual([])
    expect(r.input.variants.map((v) => v.priceCents)).toEqual([1890, 990055])
  })

  it('rejects a promotional price that is not below the price', () => {
    const rows = baseCatalog()
    rows.Variantes![0]!.precio_promocional_ars = '18900'
    expect(errors(validate(rows)).map((e) => e.field)).toEqual(['precio_promocional_ars'])
  })

  it('rejects references to codes that exist nowhere', () => {
    const rows = baseCatalog()
    rows.Prod_Necesidades!.push({ codigo_producto: 'ma-serum', codigo_necesidad: 'acne', relevancia: '50' })
    const e = errors(validate(rows))
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ sheet: 'Prod_Necesidades', row: 4, field: 'codigo_necesidad' })
  })

  it('accepts references to codes already in the database', () => {
    const rows = baseCatalog()
    rows.Prod_Necesidades!.push({ codigo_producto: 'ma-serum', codigo_necesidad: 'acne', relevancia: '50' })
    const existing = emptyExisting()
    existing.concerns.add('acne')
    expect(errors(validate(rows, 'S1', existing))).toEqual([])
  })

  it('requires exactly one main variant when a product has several', () => {
    const rows = baseCatalog()
    rows.Variantes!.push(variant('MA-SER-15', 'ma-serum', { variante_principal: 'Sí', tamano: '15' }))
    expect(errors(validate(rows))[0]).toMatchObject({ sheet: 'Variantes', row: 4, field: 'variante_principal' })
  })

  it('enforces headline and chip limits', () => {
    const rows = baseCatalog()
    Object.assign(rows.Productos![0]!, { frase_principal: 'una dos tres cuatro cinco seis siete ocho nueve', chips: 'Uno | Dos | Tres | Cuatro' })
    expect(errors(validate(rows)).map((e) => e.field)).toEqual(['frase_principal', 'chips'])
  })

  it('warns when the declared "sin fragancia" contradicts the INCI', () => {
    const rows = baseCatalog()
    rows.Productos![1]!.sin_fragancia = 'Sí'
    expect(warnings(validate(rows))).toEqual([expect.objectContaining({ sheet: 'Productos', row: 3, field: 'sin_fragancia' })])
  })

  it('warns about price changes against the database', () => {
    const existing = emptyExisting()
    existing.products.add('ma-serum')
    existing.variants.set('MA-SER-30', { priceCents: 1_500_000, productCode: 'ma-serum' })
    expect(warnings(validate(baseCatalog(), 'S1', existing))[0]?.message).toBe('El precio cambia de 15000 a 18900 (+26%).')
  })

  it('reports S5 columns as missing in a sample, and as errors in the full catalog', () => {
    const s1 = validate(baseCatalog(), 'S1')
    expect(errors(s1)).toEqual([])
    expect(s1.missing).toContainEqual({ sheet: 'Productos', field: 'anmat_registro', rows: 2 })
    const s5 = validate(baseCatalog(), 'S5')
    expect(errors(s5).some((e) => e.sheet === 'Productos' && e.field === 'anmat_registro')).toBe(true)
  })

  it('accepts list values without accents or with other casing', () => {
    const rows = baseCatalog()
    rows.Productos!.push(product('ma-tonico', { paso_rutina: 'tonico', estado: 'borrador', textura: 'locion' }))
    rows.Variantes!.push(variant('MA-TON-100', 'ma-tonico'))
    const r = validate(rows)
    expect(errors(r)).toEqual([])
    expect(r.input.products.find((p) => p.code === 'ma-tonico')).toMatchObject({ routineStep: 'TONER', texture: 'Loción' })
  })
})
