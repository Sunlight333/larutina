import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/server/services/admin/catalog/bulk'
import { productCompleteness } from '../../src/server/services/admin/catalog/completeness'
import { diffValues, publishedStatus } from '../../src/server/services/admin/catalog/product-fields'
import { imageWarnings } from '../../src/server/services/admin/catalog/product-images'

const complete = {
  type: 'PRODUCT',
  images: ['a.jpg'],
  inciText: 'Water',
  ingredientCount: 1,
  complementaryCount: 1,
  name: 'Sérum',
  brandId: 'b',
  categoryId: 'c',
  shortDescription: 'Corta.',
  description: 'Larga.',
  benefits: ['CALMÁ: rojeces'],
  whyWeChose: 'Porque sí.',
  evaluationScore: 80,
  evaluationNotes: 'Notas.',
  howToUse: 'Aplicar.',
  precautions: 'Ojos.',
  texture: 'Gel',
  routineStep: 'SERUM',
  moment: 'PM',
  durationDays: 60,
  level: 'BASIC',
  headline: 'Calma',
  anmatRegistration: 'Res. 1',
  importerHolder: 'KKOT',
}

describe('product completeness', () => {
  it('is 100% with every S1 and S5 column of Productos and an image', () => {
    expect(productCompleteness(complete)).toEqual({ percent: 100, missing: [] })
  })

  it('lists what is missing, by the panel label', () => {
    const c = productCompleteness({ ...complete, images: [], headline: null, anmatRegistration: '', complementaryCount: 0 })
    expect(c.missing.map((m) => m.label)).toEqual(['Productos complementarios', 'Al menos una imagen', 'Frase principal', 'Registro ANMAT'])
    expect(c.percent).toBeLessThan(100)
  })

  it('does not ask a kit for its own INCI', () => {
    expect(productCompleteness({ ...complete, type: 'KIT', inciText: null, ingredientCount: 0 }).missing).toEqual([])
  })
})

describe('panel helpers', () => {
  it('parses CSV with ; or , and quotes', () => {
    expect(parseCsv('﻿sku;precio_ars\r\n"A;1";"18900"\r\nB;""\r\n')).toEqual([
      ['sku', 'precio_ars'],
      ['A;1', '18900'],
      ['B', ''],
    ])
    expect(parseCsv('sku,stock\nX,"1"""\n')).toEqual([
      ['sku', 'stock'],
      ['X', '1"'],
    ])
  })

  it('keeps only real changes in a draft', () => {
    expect(diffValues({ name: 'A', chips: ['x'], vatRate: null }, { name: 'A', chips: ['y'], vatRate: null })).toEqual({ chips: ['y'] })
  })

  it('publishes as Preventa only with an arrival date', () => {
    expect(publishedStatus('2027-01-20')).toBe('PRESALE')
    expect(publishedStatus(null)).toBe('ACTIVE')
  })

  it('warns about small or non-4:5 images', () => {
    expect(imageWarnings({ width: 1600, height: 2000 })).toEqual([])
    expect(imageWarnings({ width: 1000, height: 1000 })).toHaveLength(2)
  })
})
