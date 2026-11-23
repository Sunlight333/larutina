// NAV-06: the search matcher. Accents and case, typos, synonyms, skin type,
// moment, line, prefixes for autocomplete and the "Ver todo para" link.
import { describe, expect, it } from 'vitest'
import { allowedTypos, editDistance, matchQuality } from '../../src/server/search/matcher'
import { fold, queryTokens, stem } from '../../src/server/search/normalize'
import { MemoryIndex, type SearchData, type SearchProduct } from '../../src/server/search/memory'

const product = (p: Partial<SearchProduct> & Pick<SearchProduct, 'code' | 'name'>): SearchProduct => ({
  brandCode: 'purito',
  brandName: 'Purito Seoul',
  line: null,
  categoryPath: ['serums', 'tratamiento'],
  stepLabel: 'Sérum',
  moment: 'BOTH',
  freeOf: ['fragancia', 'alcohol'],
  skinTypes: [],
  concerns: [],
  ingredients: [],
  order: 0,
  detail: '',
  ...p,
})

const data: SearchData = {
  relevance: 50,
  products: [
    product({
      code: 'pur-toner-centella',
      name: 'Purito Wonder Releaf Centella Toner Unscented',
      line: 'Wonder Releaf',
      categoryPath: ['tonicos', 'tratamiento'],
      stepLabel: 'Tónico',
      skinTypes: [{ code: 'sensible', aptitude: 'IDEAL' }, { code: 'grasa', aptitude: 'SUITABLE' }],
      concerns: [{ code: 'rojeces-sensibilidad', relevance: 85 }, { code: 'deshidratacion', relevance: 65 }],
      ingredients: [{ code: 'centella', isStar: true }, { code: 'agua', isStar: false }],
      order: 1,
    }),
    product({
      code: 'pur-serum-retinal',
      name: 'Purito Retinol Retinal 2000 NAD+ Serum',
      moment: 'PM',
      skinTypes: [{ code: 'sensible', aptitude: 'NOT_RECOMMENDED' }, { code: 'grasa', aptitude: 'IDEAL' }],
      concerns: [{ code: 'lineas-firmeza', relevance: 95 }],
      ingredients: [{ code: 'retinal', isStar: true }, { code: 'acido-hialuronico', isStar: false }],
      order: 2,
    }),
    product({
      code: 'axy-protector-fisico',
      name: 'AXIS-Y Complete No-Stress Physical Sunscreen SPF50+',
      brandCode: 'axis-y',
      brandName: 'AXIS-Y',
      categoryPath: ['protectores-solares', 'proteccion-solar'],
      stepLabel: 'Protector solar',
      moment: 'AM',
      skinTypes: [{ code: 'seca', aptitude: 'SUITABLE' }],
      concerns: [{ code: 'manchas', relevance: 60 }],
      ingredients: [{ code: 'oxido-de-zinc', isStar: true }],
      freeOf: [],
      order: 3,
    }),
    product({
      code: 'pur-crema-centella',
      name: 'Purito Wonder Releaf Centella Cream Unscented',
      line: 'Wonder Releaf',
      categoryPath: ['cremas', 'hidratacion'],
      stepLabel: 'Hidratante',
      skinTypes: [{ code: 'seca', aptitude: 'IDEAL' }],
      concerns: [{ code: 'deshidratacion', relevance: 85 }, { code: 'manchas', relevance: 30 }],
      ingredients: [{ code: 'centella', isStar: true }, { code: 'acido-hialuronico', isStar: true }],
      order: 4,
    }),
  ],
  brands: [
    { code: 'purito', name: 'Purito Seoul' },
    { code: 'axis-y', name: 'AXIS-Y' },
  ],
  categories: [
    { code: 'tratamiento', name: 'Tratamiento' },
    { code: 'tonicos', name: 'Tónicos' },
    { code: 'serums', name: 'Sérums y ampollas' },
    { code: 'hidratacion', name: 'Hidratación' },
    { code: 'cremas', name: 'Cremas y geles hidratantes' },
    { code: 'proteccion-solar', name: 'Protección solar' },
    { code: 'protectores-solares', name: 'Protectores solares' },
  ],
  concerns: [
    { code: 'rojeces-sensibilidad', name: 'Rojeces y sensibilidad', shortLabel: 'Rojeces' },
    { code: 'deshidratacion', name: 'Deshidratación y barrera', shortLabel: 'Deshidratación' },
    { code: 'lineas-firmeza', name: 'Líneas finas y firmeza', shortLabel: 'Líneas y firmeza' },
    { code: 'manchas', name: 'Manchas y tono desparejo', shortLabel: 'Manchas' },
  ],
  skinTypes: [
    { code: 'seca', name: 'Seca' },
    { code: 'grasa', name: 'Grasa' },
    { code: 'sensible', name: 'Sensible' },
  ],
  ingredients: [
    { code: 'centella', commonName: 'Centella asiática', inciName: 'Centella Asiatica Extract', hasPage: true },
    { code: 'agua', commonName: 'Agua', inciName: 'Water', hasPage: false },
    { code: 'retinal', commonName: 'Retinal', inciName: 'Retinal', hasPage: true },
    { code: 'acido-hialuronico', commonName: 'Ácido hialurónico', inciName: 'Sodium Hyaluronate', hasPage: true },
    { code: 'oxido-de-zinc', commonName: 'Óxido de zinc', inciName: 'Zinc Oxide', hasPage: false },
  ],
  synonyms: [
    { term: 'Hidratación', type: 'CONCERN', targetCode: 'deshidratacion', variants: ['piel deshidratada', 'falta de hidratación'] },
    { term: 'Anti-age', type: 'CONCERN', targetCode: 'lineas-firmeza', variants: ['antiedad', 'arrugas'] },
    { term: 'Sensible', type: 'SKIN_TYPE', targetCode: 'sensible', variants: ['reactiva', 'me pica', 'colorada'] },
  ],
}

const index = new MemoryIndex(data)
const codes = (q: string) => index.search(q).products.map((p) => p.code)

describe('normalisation', () => {
  it('ignores accents and case, and strips plurals', () => {
    expect(fold('ÁCIDO Hialurónico')).toBe('acido hialuronico')
    expect(stem('manchas')).toBe('mancha')
    expect(stem('noches')).toBe('noche')
    expect(stem('ojos')).toBe('ojos') // short words stay
    expect(queryTokens('Algo para la piel SECA')).toEqual(['seca'])
  })
})

describe('typo tolerance', () => {
  it('allows one edit from 4 letters and two from 8', () => {
    expect(allowedTypos('sol')).toBe(0)
    expect(allowedTypos('seca')).toBe(1)
    expect(allowedTypos('niacinamida')).toBe(2)
    expect(editDistance('centela', 'centella')).toBe(1)
    expect(editDistance('cnetella', 'centella')).toBe(1) // a swapped pair is one edit
    expect(editDistance('abc', 'xyz', 1)).toBeGreaterThan(1)
  })

  it('matches exactly, by prefix and with typos', () => {
    expect(matchQuality('crema', 'crema')).toBe(1)
    expect(matchQuality('cre', 'crema')).toBeGreaterThan(0)
    expect(matchQuality('cerma', 'crema')).toBeGreaterThan(0)
    expect(matchQuality('sol', 'sal')).toBe(0) // too short for a typo
  })
})

describe('search', () => {
  it('finds by name, accent and case insensitive, with typos', () => {
    expect(codes('centella')).toEqual(expect.arrayContaining(['pur-toner-centella', 'pur-crema-centella']))
    expect(codes('CENTELA')).toEqual(expect.arrayContaining(['pur-toner-centella', 'pur-crema-centella']))
    expect(codes('tonico')).toEqual(['pur-toner-centella'])
    expect(codes('retnal')).toEqual(['pur-serum-retinal'])
  })

  it('finds by brand and by ingredient (common and INCI name)', () => {
    expect(codes('axis-y')).toEqual(['axy-protector-fisico'])
    expect(codes('ácido hialurónico')).toEqual(expect.arrayContaining(['pur-serum-retinal', 'pur-crema-centella']))
    // The star ingredient ranks first.
    expect(codes('acido hialuronico')[0]).toBe('pur-crema-centella')
    expect(codes('zinc oxide')).toEqual(['axy-protector-fisico'])
  })

  it('finds by category and need', () => {
    expect(codes('protector solar')).toEqual(['axy-protector-fisico'])
    expect(codes('rojeces')).toEqual(['pur-toner-centella'])
    // Below the relevance threshold a product does not count under a need.
    expect(codes('manchas')).toEqual(['axy-protector-fisico'])
  })

  it('resolves synonyms to their need or skin type', () => {
    expect(codes('hidratación')).toEqual(expect.arrayContaining(['pur-toner-centella', 'pur-crema-centella']))
    expect(codes('arrugas')).toEqual(['pur-serum-retinal'])
    expect(codes('antiedad')).toEqual(['pur-serum-retinal'])
    expect(codes('piel reactiva')).toEqual(['pur-toner-centella'])
  })

  it('finds by skin type, Ideal or Apto only', () => {
    expect(codes('piel sensible')).toEqual(['pur-toner-centella'])
    expect(codes('piel seca')).toEqual(expect.arrayContaining(['pur-crema-centella', 'axy-protector-fisico']))
    expect(codes('piel seca')[0]).toBe('pur-crema-centella') // Ideal before Apto
  })

  it('finds by moment: an AM y PM product is in both', () => {
    expect(codes('noche')).toEqual(expect.arrayContaining(['pur-serum-retinal', 'pur-toner-centella', 'pur-crema-centella']))
    expect(codes('noche')).not.toContain('axy-protector-fisico')
    expect(codes('de día')).toContain('axy-protector-fisico')
    expect(codes('mañana')).not.toContain('pur-serum-retinal')
  })

  it('finds by line', () => {
    expect(codes('wonder releaf')).toEqual(expect.arrayContaining(['pur-toner-centella', 'pur-crema-centella']))
    expect(codes('wonder releaf')).toHaveLength(2)
  })

  it('combines words: every word must match the product', () => {
    expect(codes('sérum de noche')).toEqual(['pur-serum-retinal'])
    expect(codes('crema hidratación')).toEqual(['pur-crema-centella'])
  })

  it('reads "sin fragancia" as the computed flag, not as the word', () => {
    expect(codes('protector sin fragancia')).toEqual([])
    expect(codes('centella sin fragancia')).toHaveLength(2)
  })

  it('returns nothing for nonsense', () => {
    expect(codes('xyzzy')).toEqual([])
    expect(index.search('   ').products).toEqual([])
  })

  it('names the need behind the query, for "Ver todo para"', () => {
    expect(index.search('tengo manchas').concern).toEqual({ code: 'manchas', name: 'Manchas y tono desparejo' })
    expect(index.search('hidratacion').concern?.code).toBe('deshidratacion')
    expect(index.search('centella').concern).toBeNull()
  })
})

describe('suggest', () => {
  it('autocompletes by prefix and groups by type', () => {
    const s = index.suggest('centel')
    expect(s.groups.map((g) => g.kind)).toEqual(['productos', 'ingredientes'])
    expect(s.groups[1]!.items[0]).toMatchObject({ label: 'Centella asiática', href: '/ingrediente/centella' })
  })

  it('offers the need page when the query names a need', () => {
    const s = index.suggest('deshidrat')
    expect(s.seeAll).toEqual({ label: 'Ver todo para Deshidratación y barrera', href: '/necesidad/deshidratacion' })
    expect(s.groups.find((g) => g.kind === 'necesidades')?.items[0]?.href).toBe('/necesidad/deshidratacion')
  })

  it('lists brands and categories', () => {
    expect(index.suggest('puri').groups.find((g) => g.kind === 'marcas')?.items[0]?.label).toBe('Purito Seoul')
    expect(index.suggest('protectores').groups.find((g) => g.kind === 'categorias')?.items[0]?.href).toBe('/categoria/protectores-solares')
  })

  it('never links an ingredient without a page', () => {
    const s = index.suggest('agua')
    expect(s.groups.find((g) => g.kind === 'ingredientes')).toBeUndefined()
  })
})
