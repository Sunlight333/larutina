// Catalog rules (03-data-model §2) and the listing engine (NAV-02, NAV-03),
// pure functions over plain data.
import { describe, expect, it } from 'vitest'
import {
  cardLabels,
  chargedCents,
  firstSentence,
  isNew,
  lowerFirst,
  momentMatches,
  orInherit,
  overlayDraft,
  paragraphs,
  parseBenefits,
  presaleLabel,
  priceWithoutNationalTaxes,
  sizeLabel,
  stockState,
  unitPrice,
  variantAvailable,
  variantDurationDays,
} from '../../src/server/services/catalog/rules'
import { listingHref, parseListingState, emptyListingState, patchState } from '../../src/server/services/catalog/listing-params'
import { runListing, recommendedOrder, type ListingTaxonomy, type ListingSettings } from '../../src/server/services/catalog/listing'
import type { CatalogItem, CatalogVariant } from '../../src/server/services/catalog/catalog'
import { videoSource } from '../../src/server/services/catalog/product'
import { cleanSkus } from '../../src/server/services/catalog/cart'

describe('prices (PDP-02)', () => {
  it('charges the promo price when there is one', () => {
    expect(chargedCents({ priceCents: 50_000_00, promoPriceCents: null })).toBe(50_000_00)
    expect(chargedCents({ priceCents: 50_000_00, promoPriceCents: 45_000_00 })).toBe(45_000_00)
    // A promo that is not below the price is ignored (the import rejects it anyway).
    expect(chargedCents({ priceCents: 50_000_00, promoPriceCents: 60_000_00 })).toBe(50_000_00)
  })

  it('computes the unit price on the charged price', () => {
    const charged = chargedCents({ priceCents: 20_000_00, promoPriceCents: 15_000_00 })
    expect(unitPrice(charged, 150, 'ML')).toEqual({ cents: 10_000_00, per: '100 ml' })
    expect(unitPrice(charged, 50, 'G')).toEqual({ cents: 30_000_00, per: '100 g' })
    expect(unitPrice(charged, 3, 'UNITS')).toEqual({ cents: 5_000_00, per: 'unidad' })
    expect(unitPrice(charged, 0, 'ML')).toBeNull()
  })

  it('removes national VAT with the product rate or the general one', () => {
    expect(priceWithoutNationalTaxes(12_100_00, 21)).toBe(10_000_00)
    expect(priceWithoutNationalTaxes(11_050_00, 10.5)).toBe(10_000_00)
    expect(priceWithoutNationalTaxes(10_000_00, 0)).toBe(10_000_00)
    // Always whole centavos.
    expect(Number.isInteger(priceWithoutNationalTaxes(57_480_00, 21))).toBe(true)
  })
})

describe('sizes and durations (CAT-09)', () => {
  it('labels sizes', () => {
    expect(sizeLabel(150, 'ML')).toBe('150 ml')
    expect(sizeLabel(2.5, 'G')).toBe('2,5 g')
    expect(sizeLabel(1, 'UNITS')).toBe('1 unidad')
    expect(sizeLabel(4, 'UNITS')).toBe('4 unidades')
  })

  it('uses the variant value, then the product value, then a proportional estimate', () => {
    const main = { size: 200, unit: 'ML' as const, durationDays: null, isMain: true }
    const mini = { size: 30, unit: 'ML' as const, durationDays: null, isMain: false }
    // The 30 ml and the 200 ml toner last different times.
    expect(variantDurationDays(main, { durationDays: 75 }, main)).toBe(75)
    expect(variantDurationDays(mini, { durationDays: 75 }, main)).toBe(11)
    expect(variantDurationDays({ ...mini, durationDays: 14 }, { durationDays: 75 }, main)).toBe(14)
    expect(variantDurationDays(mini, { durationDays: 75 }, { ...main, durationDays: 100 })).toBe(15)
    expect(variantDurationDays(mini, { durationDays: null }, main)).toBeNull()
    // Units that cannot be compared fall back to the product value.
    expect(variantDurationDays({ ...mini, unit: 'G' }, { durationDays: 75 }, main)).toBe(75)
  })
})

describe('labels and stock (CAT-12, NAV-04, NAV-08)', () => {
  const now = new Date('2026-11-23T12:00:00Z')
  it('shows "Nuevo" for N days after publication, never with 0', () => {
    expect(isNew(new Date('2026-11-01T00:00:00Z'), 30, now)).toBe(true)
    expect(isNew(new Date('2026-10-01T00:00:00Z'), 30, now)).toBe(false)
    expect(isNew(new Date('2026-11-22T00:00:00Z'), 0, now)).toBe(false)
    expect(isNew(null, 30, now)).toBe(false)
  })

  it('keeps "Recomendado por dermatóloga" locked until the panel enables it', () => {
    const p = { labels: ['LIMITED_EDITION', 'DERMATOLOGIST_RECOMMENDED'] as const, publishedAt: new Date('2026-01-01') }
    expect(cardLabels({ ...p, labels: [...p.labels] }, { newDays: 30, dermatologistEnabled: false }, now)).toEqual(['Edición limitada'])
    expect(cardLabels({ ...p, labels: [...p.labels] }, { newDays: 30, dermatologistEnabled: true }, now)).toEqual(['Edición limitada', 'Recomendado por dermatóloga'])
    expect(cardLabels({ labels: [], publishedAt: new Date('2026-11-20') }, { newDays: 30, dermatologistEnabled: false }, now)).toEqual(['Nuevo'])
  })

  it('sells pre-sale without stock and never sells Agotado', () => {
    expect(variantAvailable('PRESALE', 0)).toBe(true)
    expect(variantAvailable('ACTIVE', 0)).toBe(false)
    expect(variantAvailable('ACTIVE', 3)).toBe(true)
    expect(variantAvailable('SOLD_OUT', 3)).toBe(false)
    expect(stockState('ACTIVE', [{ stock: 0 }, { stock: 2 }])).toBe('available')
    expect(stockState('ACTIVE', [{ stock: 0 }])).toBe('out')
    expect(stockState('PRESALE', [{ stock: 0 }])).toBe('presale')
  })

  it('writes the pre-sale date (G-14)', () => {
    expect(presaleLabel(new Date('2026-12-20T00:00:00Z'), now)).toBe('Preventa · llega el 20 de diciembre')
    expect(presaleLabel(new Date('2027-01-20T00:00:00Z'), now)).toBe('Preventa · llega el 20 de enero de 2027')
    expect(presaleLabel(null, now)).toBe('Preventa')
  })

  it('puts an "AM y PM" product in both moments', () => {
    expect(momentMatches('BOTH', 'AM')).toBe(true)
    expect(momentMatches('BOTH', 'PM')).toBe(true)
    expect(momentMatches('AM', 'PM')).toBe(false)
  })
})

describe('texts', () => {
  it('splits benefits at the verb (F-12)', () => {
    expect(parseBenefits(['CALMÁ: reduce rojeces', 'hidratá: aporta agua | Sin verbo'])).toEqual([
      { verb: 'CALMÁ', text: 'reduce rojeces' },
      { verb: 'HIDRATÁ', text: 'aporta agua' },
      { verb: null, text: 'Sin verbo' },
    ])
  })

  it('turns panel text into paragraphs and meta descriptions', () => {
    expect(paragraphs('Uno.\n\nDos.\n')).toEqual(['Uno.', 'Dos.'])
    expect(paragraphs(null)).toEqual([])
    expect(firstSentence('Primera oración. Segunda.')).toBe('Primera oración.')
    expect(firstSentence('a '.repeat(100), 20).length).toBeLessThanOrEqual(20)
  })

  it('lowercases a leading capital but not an acronym', () => {
    expect(lowerFirst('Ácido exfoliante (AHA, BHA)')).toBe('ácido exfoliante (AHA, BHA)')
    expect(lowerFirst('NAD+')).toBe('NAD+')
  })

  it('lets a travel size inherit empty fields from its base (CAT-07)', () => {
    expect(orInherit('', 'Del base')).toBe('Del base')
    expect(orInherit([], ['a'])).toEqual(['a'])
    expect(orInherit('Propio', 'Del base')).toBe('Propio')
    expect(orInherit(null, undefined)).toBeNull()
  })
})

describe('draft overlay (ADM-02)', () => {
  const product = { name: 'Original', headline: 'Frase', chips: ['A'], presaleDate: null as Date | null, vatRate: null as number | null, brandId: 'b1', status: 'ACTIVE' }

  it('lays the pending edits over the columns', () => {
    const out = overlayDraft(product, { name: 'Nuevo nombre', chips: ['B', 'C'], presaleDate: '2027-01-20', vatRate: 10.5, headline: null })
    expect(out).toMatchObject({ name: 'Nuevo nombre', chips: ['B', 'C'], vatRate: 10.5, headline: null })
    expect(out.presaleDate?.toISOString()).toBe('2027-01-20T00:00:00.000Z')
  })

  it('ignores unknown keys, wrong types and nulls on required fields', () => {
    const out = overlayDraft(product, { status: 'DRAFT', name: null, chips: 'no', id: 'x', vatRate: 'abc' })
    expect(out).toEqual(product)
    expect(overlayDraft(product, null)).toEqual(product)
    expect(overlayDraft(product, ['x'])).toEqual(product)
  })
})

describe('video sources (CAT-17)', () => {
  it('embeds YouTube and Vimeo, plays MP4 files, resolves uploads', () => {
    expect(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(videoSource('https://vimeo.com/123456789')).toEqual({ kind: 'embed', src: 'https://player.vimeo.com/video/123456789' })
    expect(videoSource('https://cdn.example.com/a.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/a.mp4' })
    expect(videoSource('producto_video.mp4')).toEqual({ kind: 'media', ref: 'producto_video.mp4' })
    expect(videoSource('http://insecure.example.com/a.mp4')).toBeNull()
    expect(videoSource('')).toBeNull()
  })
})

describe('cart SKUs', () => {
  it('keeps valid, unique SKUs only', () => {
    expect(cleanSkus(['LRB-1', 'LRB-1', ' LRB-2 ', '<script>', ''])).toEqual(['LRB-1', 'LRB-2'])
  })
})

// ------------------------------------------------------------- listing ----

const variant = (sku: string, price: number, extra: Partial<CatalogVariant> = {}): CatalogVariant => ({
  sku,
  size: 50,
  unit: 'ML',
  sizeLabel: '50 ml',
  priceCents: price,
  promoPriceCents: null,
  chargedCents: price,
  stock: 5,
  available: true,
  isMain: true,
  durationDays: null,
  ...extra,
})

const item = (code: string, p: Partial<CatalogItem> = {}): CatalogItem => {
  const main = p.main ?? variant(`${code}-1`, 10_000_00)
  return {
    id: code,
    code,
    name: code,
    type: 'PRODUCT',
    status: 'ACTIVE',
    brand: { id: 'b1', code: 'purito', name: 'Purito' },
    categoryId: 'c',
    categoryPath: ['serums', 'tratamiento'],
    line: null,
    moment: 'BOTH',
    routineStep: 'SERUM',
    stepLabel: 'Sérum',
    fragranceFree: true,
    seals: { vegan: 'UNKNOWN', crueltyFree: 'UNKNOWN', dermatologistTested: 'UNKNOWN' },
    skinTypes: [],
    concerns: [],
    priority: null,
    manualOrder: null,
    publishedAt: new Date('2026-11-01'),
    labels: [],
    presale: null,
    stock: 'available',
    image: null,
    variants: [main],
    ...p,
    main,
  }
}

const taxonomy: ListingTaxonomy = {
  skinTypes: [
    { code: 'seca', name: 'Seca' },
    { code: 'grasa', name: 'Grasa' },
  ],
  concerns: [
    { code: 'manchas', name: 'Manchas' },
    { code: 'acne', name: 'Acné' },
  ],
  categories: [
    { id: 't', code: 'tratamiento', name: 'Tratamiento', parentId: null },
    { id: 's', code: 'serums', name: 'Sérums', parentId: 't' },
    { id: 'l', code: 'limpiadores', name: 'Limpiadores', parentId: null },
  ],
  brands: [
    { code: 'axis-y', name: 'AXIS-Y' },
    { code: 'purito', name: 'Purito' },
  ],
}
const settings: ListingSettings = { pageSize: 2, relevance: 50, sealFilter: false, bestSellers: false, topRated: false }

const catalog: CatalogItem[] = [
  item('a', { skinTypes: [{ code: 'seca', aptitude: 'IDEAL' }], concerns: [{ code: 'manchas', relevance: 80 }], moment: 'AM', main: variant('a-1', 30_000_00), priority: 2 }),
  item('b', { skinTypes: [{ code: 'seca', aptitude: 'CAUTION' }, { code: 'grasa', aptitude: 'SUITABLE' }], concerns: [{ code: 'manchas', relevance: 40 }], moment: 'PM', main: variant('b-1', 10_000_00), priority: 1 }),
  item('c', { brand: { id: 'b2', code: 'axis-y', name: 'AXIS-Y' }, categoryPath: ['limpiadores'], skinTypes: [{ code: 'grasa', aptitude: 'IDEAL' }], moment: 'BOTH', fragranceFree: false, main: variant('c-1', 20_000_00), manualOrder: 1 }),
  item('kit', { type: 'KIT', categoryPath: ['serums', 'tratamiento'], main: variant('k-1', 50_000_00), publishedAt: new Date('2026-11-20') }),
]

const run = (query: Record<string, string | string[]>, scope = {}, s: Partial<ListingSettings> = {}) => runListing(catalog, parseListingState(query), taxonomy, { ...settings, ...s }, scope)
const codes = (r: ReturnType<typeof run>) => r.items.map((p) => p.code)
const facet = (r: ReturnType<typeof run>, group: string) => Object.fromEntries(r.facets.find((f) => f.group === group)?.options.map((o) => [o.value, o.count]) ?? [])

describe('listing filters (NAV-02)', () => {
  it('filters by skin type with Ideal or Apto only', () => {
    const r = run({ piel: 'seca', pagina: '9' })
    expect(codes(r)).toEqual(['a'])
    expect(codes(run({ piel: 'grasa', pagina: '9' })).sort()).toEqual(['b', 'c'])
  })

  it('adds options within a group and combines groups', () => {
    expect(codes(run({ piel: ['seca', 'grasa'], pagina: '9' })).sort()).toEqual(['a', 'b', 'c'])
    expect(codes(run({ piel: ['seca', 'grasa'], momento: 'noche', pagina: '9' })).sort()).toEqual(['b', 'c'])
  })

  it('counts each option as if it were ticked too', () => {
    const r = run({ piel: 'seca' })
    expect(facet(r, 'piel')).toEqual({ seca: 1, grasa: 2 })
    expect(facet(r, 'momento')).toEqual({ manana: 1, noche: 0 })
  })

  it('needs relevance at or above the threshold', () => {
    expect(codes(run({ necesidad: 'manchas', pagina: '9' }))).toEqual(['a'])
    expect(facet(run({}), 'necesidad')).toEqual({ manchas: 1 })
  })

  it('includes subcategories and leaves kits out of the product type filter', () => {
    expect(codes(run({ tipo: 'tratamiento', pagina: '9' })).sort()).toEqual(['a', 'b'])
    expect(facet(run({}), 'tipo')).toEqual({ tratamiento: 2, serums: 2, limpiadores: 1 })
  })

  it('filters by brand, price range and "Sin fragancia"', () => {
    expect(codes(run({ marca: 'axis-y' }))).toEqual(['c'])
    expect(codes(run({ precio_min: '15000', precio_max: '30000', pagina: '9' })).sort()).toEqual(['a', 'c'])
    expect(codes(run({ sin_fragancia: '1', pagina: '9' })).sort()).toEqual(['a', 'b', 'kit'])
  })

  it('takes the price slider bounds from the catalog', () => {
    expect(run({ marca: 'purito' }).priceBounds).toEqual({ min: 10_000, max: 50_000 })
  })

  it('ignores codes that do not exist instead of emptying the grid', () => {
    const r = run({ piel: 'inexistente', pagina: '9' })
    expect(r.total).toBe(4)
    expect(r.state.piel).toEqual([])
  })

  it('shows the seal filter only when the panel turns it on, with "Sí" only (CAT-14)', () => {
    expect(run({}).facets.some((f) => f.group === 'sello')).toBe(false)
    const withSeal = runListing([...catalog, item('v', { seals: { vegan: 'YES', crueltyFree: 'UNKNOWN', dermatologistTested: 'NO' } })], parseListingState({ sello: 'vegano' }), taxonomy, { ...settings, sealFilter: true })
    expect(withSeal.items.map((p) => p.code)).toEqual(['v'])
    expect(Object.fromEntries(withSeal.facets.find((f) => f.group === 'sello')!.options.map((o) => [o.value, o.count]))).toEqual({ vegano: 1 })
  })

  it('locks the scope of a brand or need page and hides its own filter', () => {
    const r = run({}, { brand: 'purito' })
    expect(r.total).toBe(3)
    expect(r.facets.some((f) => f.group === 'marca')).toBe(false)
    expect(run({}, { concern: 'manchas' }).total).toBe(1)
  })
})

describe('listing sort and pages (NAV-03)', () => {
  it('orders "Recomendados" by priority, then manual order, then name', () => {
    expect([...catalog].sort(recommendedOrder).map((p) => p.code)).toEqual(['b', 'a', 'c', 'kit'])
  })

  it('sorts by price and by newest', () => {
    expect(codes(run({ orden: 'precio-asc', pagina: '9' }))).toEqual(['b', 'c', 'a', 'kit'])
    expect(codes(run({ orden: 'precio-desc', pagina: '9' }))).toEqual(['kit', 'a', 'c', 'b'])
    expect(codes(run({ orden: 'novedades' }))[0]).toBe('kit')
  })

  it('offers "Más vendidos" and "Mejor valorados" only when switched on', () => {
    expect(run({}).sorts.map((s) => s.value)).toEqual(['recomendados', 'precio-asc', 'precio-desc', 'novedades'])
    expect(run({ orden: 'mas-vendidos' }).sort).toBe('recomendados')
    const on = run({ orden: 'mas-vendidos', pagina: '9' }, {}, { bestSellers: true, topRated: true })
    expect(on.sorts.map((s) => s.value)).toContain('mejor-valorados')
    expect(on.sort).toBe('mas-vendidos')
    // No sales data yet: the recommended order.
    expect(codes(on)).toEqual(['b', 'a', 'c', 'kit'])
  })

  it('pages in batches of the page size, cumulatively ("Ver más productos")', () => {
    expect(run({}).items).toHaveLength(2)
    expect(run({}).hasMore).toBe(true)
    expect(run({ pagina: '2' }).items).toHaveLength(4)
    expect(run({ pagina: '2' }).hasMore).toBe(false)
  })

  it('ranks search results by relevance by default', () => {
    const rank = new Map([
      ['c', 0],
      ['a', 1],
    ])
    const r = run({}, { rank })
    expect(r.sort).toBe('relevancia')
    expect(codes(r)).toEqual(['c', 'a'])
  })
})

describe('listing URLs', () => {
  it('round-trips the state through the URL and resets the page on change', () => {
    const s = parseListingState({ piel: ['seca', 'grasa'], momento: 'noche', precio_min: '1.000', sin_fragancia: '1', orden: 'novedades', pagina: '3' })
    expect(s).toMatchObject({ piel: ['seca', 'grasa'], momento: ['noche'], precioMin: 1000, sinFragancia: true, orden: 'novedades', pagina: 3 })
    expect(listingHref('/productos', s)).toBe('/productos?piel=seca&piel=grasa&momento=noche&sin_fragancia=1&precio_min=1000&orden=novedades&pagina=3')
    expect(listingHref('/productos', patchState(s, { piel: [] }))).toBe('/productos?momento=noche&sin_fragancia=1&precio_min=1000&orden=novedades')
    expect(listingHref('/buscar', emptyListingState(), { q: 'crema' })).toBe('/buscar?q=crema')
  })

  it('drops values that are not codes', () => {
    expect(parseListingState({ piel: '<script>', momento: 'tarde', orden: 'raro', pagina: '-1' })).toEqual(emptyListingState())
  })
})
