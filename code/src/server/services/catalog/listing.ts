// Listing filters, facet counts and sorts (NAV-02, NAV-03), pure over the
// catalog snapshot. Within a group the options add up (piel seca o sensible);
// between groups they combine (seca y que trabaje rojeces), as S-10 explains.
// Each option's count is what the grid would show if it were also ticked.
import type { CatalogItem } from './catalog'
import { momentMatches } from './rules'
import { MOMENT_VALUES, SEAL_VALUES, SORT_LABELS, type FilterGroup, type ListingState, type SortKey } from './listing-params'

export type Named = { code: string; name: string }
export type CategoryOption = Named & { id: string; parentId: string | null }

export type ListingTaxonomy = {
  skinTypes: Named[]
  /** Already in the panel's order (listing.concernOrder). */
  concerns: Named[]
  /** In tree order. */
  categories: CategoryOption[]
  brands: Named[]
}

export type ListingSettings = {
  pageSize: number
  /** Minimum relevance for a product to count under a need (catalog.pdpRelevance). */
  relevance: number
  sealFilter: boolean
  bestSellers: boolean
  topRated: boolean
}

/** A fixed part of the listing: the brand of a brand page, the results of a search… */
export type ListingScope = {
  brand?: string
  category?: string
  concern?: string
  /** Search results: only these products, ranked (lower is better). */
  rank?: Map<string, number>
}

export type FacetOption = { value: string; label: string; count: number; selected: boolean; depth: number }
export type Facet = { group: FilterGroup; label: string; options: FacetOption[] }

export type ListingResult = {
  /** The state actually applied: unknown codes dropped. */
  state: ListingState
  items: CatalogItem[]
  total: number
  hasMore: boolean
  facets: Facet[]
  fragranceFree: { count: number; selected: boolean } | null
  /** Whole pesos, from the products in scope (NAV-02: the slider runs from the catalog's minimum to its maximum). */
  priceBounds: { min: number; max: number } | null
  sorts: { value: SortKey; label: string }[]
  sort: SortKey
}

const GROUP_LABELS: Record<FilterGroup, string> = {
  piel: 'Tipo de piel',
  necesidad: 'Lo que querés mejorar',
  tipo: 'Tipo de producto',
  marca: 'Marca',
  momento: 'Momento',
  sello: 'Sellos',
}

const MOMENT_OPTIONS = [
  { value: 'manana', label: 'De mañana' },
  { value: 'noche', label: 'De noche' },
]
const SEAL_OPTIONS = [
  { value: 'vegano', label: 'Vegano' },
  { value: 'cruelty-free', label: 'Cruelty free' },
  { value: 'testeado', label: 'Testeado dermatológicamente' },
]

type Predicate = (p: CatalogItem) => boolean

function groupPredicate(group: FilterGroup, values: string[], relevance: number): Predicate | null {
  if (!values.length) return null
  const set = new Set(values)
  switch (group) {
    case 'piel':
      // S-03: products Ideal or Apto for that skin.
      return (p) => p.skinTypes.some((s) => set.has(s.code) && (s.aptitude === 'IDEAL' || s.aptitude === 'SUITABLE'))
    case 'necesidad':
      return (p) => p.concerns.some((c) => set.has(c.code) && c.relevance >= relevance)
    case 'tipo':
      // S-05: kits and travel sizes stay out of the product type filter.
      return (p) => p.type === 'PRODUCT' && p.categoryPath.some((c) => set.has(c))
    case 'marca':
      return (p) => set.has(p.brand.code)
    case 'momento':
      return (p) => values.some((m) => momentMatches(p.moment, MOMENT_VALUES[m as keyof typeof MOMENT_VALUES]))
    case 'sello':
      // CAT-14: only "Sí" counts; "Sin dato" never matches.
      return (p) => values.some((s) => p.seals[SEAL_VALUES[s as keyof typeof SEAL_VALUES]] === 'YES')
  }
}

function scopePredicate(scope: ListingScope, relevance: number): Predicate {
  return (p) =>
    (!scope.brand || p.brand.code === scope.brand) &&
    (!scope.category || p.categoryPath.includes(scope.category)) &&
    (!scope.concern || p.concerns.some((c) => c.code === scope.concern && c.relevance >= relevance)) &&
    (!scope.rank || scope.rank.has(p.code))
}

const cmpNullsLast = (a: number | null, b: number | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b)
const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name, 'es')

/** NAV-03: "Recomendados" follows the priority, then the panel's manual order, then the name. */
export function recommendedOrder(a: CatalogItem, b: CatalogItem): number {
  return cmpNullsLast(a.priority, b.priority) || cmpNullsLast(a.manualOrder, b.manualOrder) || byName(a, b)
}

export function availableSorts(settings: Pick<ListingSettings, 'bestSellers' | 'topRated'>, search: boolean): SortKey[] {
  const sorts: SortKey[] = search ? ['relevancia', 'recomendados'] : ['recomendados']
  sorts.push('precio-asc', 'precio-desc', 'novedades')
  if (settings.bestSellers) sorts.push('mas-vendidos')
  if (settings.topRated) sorts.push('mejor-valorados')
  return sorts
}

export function sortItems(items: CatalogItem[], sort: SortKey, rank?: Map<string, number>): CatalogItem[] {
  const out = [...items]
  switch (sort) {
    case 'precio-asc':
      return out.sort((a, b) => a.main.chargedCents - b.main.chargedCents || byName(a, b))
    case 'precio-desc':
      return out.sort((a, b) => b.main.chargedCents - a.main.chargedCents || byName(a, b))
    case 'novedades':
      return out.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || recommendedOrder(a, b))
    case 'relevancia':
      if (rank) return out.sort((a, b) => (rank.get(a.code) ?? 1e9) - (rank.get(b.code) ?? 1e9) || recommendedOrder(a, b))
      return out.sort(recommendedOrder)
    default:
      // "Más vendidos" and "Mejor valorados" have no data until Phase 2: the
      // panel only turns them on once there is, and until then they fall
      // back to the recommended order rather than showing an invented one.
      return out.sort(recommendedOrder)
  }
}

export function runListing(catalog: CatalogItem[], requested: ListingState, taxonomy: ListingTaxonomy, settings: ListingSettings, scope: ListingScope = {}): ListingResult {
  // Codes that do not exist (an old link, a typo in the URL) are ignored
  // rather than emptying the grid.
  const known = (values: string[], list: { code: string }[]) => values.filter((v) => list.some((x) => x.code === v))
  const state: ListingState = {
    ...requested,
    piel: known(requested.piel, taxonomy.skinTypes),
    necesidad: known(requested.necesidad, taxonomy.concerns),
    tipo: known(requested.tipo, taxonomy.categories),
    marca: known(requested.marca, taxonomy.brands),
    sello: settings.sealFilter ? requested.sello : [],
  }
  const inScope = catalog.filter(scopePredicate(scope, settings.relevance))
  const locked = new Set<FilterGroup>()
  if (scope.brand) locked.add('marca')
  if (scope.concern) locked.add('necesidad')
  const groups: FilterGroup[] = ['piel', 'necesidad', 'tipo', 'marca', 'momento', ...(settings.sealFilter ? (['sello'] as const) : [])]
  const active = groups.filter((g) => !locked.has(g))

  const predicates = new Map<FilterGroup, Predicate>()
  for (const g of active) {
    const pred = groupPredicate(g, state[g], settings.relevance)
    if (pred) predicates.set(g, pred)
  }
  const minCents = state.precioMin != null ? state.precioMin * 100 : null
  const maxCents = state.precioMax != null ? state.precioMax * 100 : null
  const price: Predicate | null =
    minCents != null || maxCents != null ? (p) => (minCents == null || p.main.chargedCents >= minCents) && (maxCents == null || p.main.chargedCents <= maxCents) : null
  const fragrance: Predicate | null = state.sinFragancia ? (p) => p.fragranceFree : null

  /** Every filter except the ones named: the base of a facet's counts. */
  const matching = (except?: FilterGroup | 'sinFragancia') =>
    inScope.filter(
      (p) =>
        [...predicates].every(([g, pred]) => g === except || pred(p)) &&
        (!price || price(p)) &&
        (except === 'sinFragancia' || !fragrance || fragrance(p)),
    )

  const results = matching()

  const countBy = (base: CatalogItem[], test: (p: CatalogItem) => boolean) => base.reduce((n, p) => n + (test(p) ? 1 : 0), 0)
  const facet = (group: FilterGroup, options: { value: string; label: string; depth?: number }[]): Facet | null => {
    const base = matching(group)
    const selected = new Set(state[group])
    const out = options
      .map((o) => {
        const pred = groupPredicate(group, [o.value], settings.relevance)!
        // Options with no product at all in this page's scope are left out;
        // the rest show their count, 0 included, so the list does not jump.
        if (!selected.has(o.value) && !inScope.some(pred)) return null
        return { value: o.value, label: o.label, depth: o.depth ?? 0, count: countBy(base, pred), selected: selected.has(o.value) }
      })
      .filter((o): o is FacetOption => !!o)
    return out.length ? { group, label: GROUP_LABELS[group], options: out } : null
  }

  const categoryOptions = (() => {
    const byId = new Map(taxonomy.categories.map((c) => [c.id, c]))
    const depth = (c: CategoryOption) => {
      let d = 0
      let at = c.parentId ? byId.get(c.parentId) : undefined
      while (at && d < 10) {
        if (scope.category && at.code === scope.category) break
        d++
        at = at.parentId ? byId.get(at.parentId) : undefined
      }
      return d
    }
    const inside = (c: CategoryOption) => {
      if (!scope.category) return true
      // On a category page the type filter narrows to its subcategories.
      let at = c.parentId ? byId.get(c.parentId) : undefined
      while (at) {
        if (at.code === scope.category) return true
        at = at.parentId ? byId.get(at.parentId) : undefined
      }
      return false
    }
    return taxonomy.categories.filter(inside).map((c) => ({ value: c.code, label: c.name, depth: depth(c) }))
  })()

  const facets = [
    active.includes('piel') && facet('piel', taxonomy.skinTypes.map((s) => ({ value: s.code, label: s.name }))),
    active.includes('necesidad') && facet('necesidad', taxonomy.concerns.map((c) => ({ value: c.code, label: c.name }))),
    active.includes('tipo') && facet('tipo', categoryOptions),
    active.includes('marca') && facet('marca', taxonomy.brands.map((b) => ({ value: b.code, label: b.name }))),
    active.includes('momento') && facet('momento', MOMENT_OPTIONS),
    active.includes('sello') && facet('sello', SEAL_OPTIONS),
  ].filter((f): f is Facet => !!f)

  const fragranceBase = matching('sinFragancia')
  const fragranceFree = inScope.some((p) => p.fragranceFree) || state.sinFragancia ? { count: countBy(fragranceBase, (p) => p.fragranceFree), selected: state.sinFragancia } : null

  const prices = inScope.map((p) => p.main.chargedCents)
  const priceBounds = prices.length ? { min: Math.floor(Math.min(...prices) / 100), max: Math.ceil(Math.max(...prices) / 100) } : null

  const sortKeys = availableSorts(settings, !!scope.rank)
  const sort: SortKey = state.orden && sortKeys.includes(state.orden) ? state.orden : sortKeys[0]!
  const sorted = sortItems(results, sort, scope.rank)
  const pageSize = Math.max(1, Math.min(200, Math.round(settings.pageSize) || 24))
  // "Ver más productos" (S-21): page n shows the first n batches.
  const shown = sorted.slice(0, pageSize * state.pagina)

  return {
    state: { ...state, orden: state.orden && sortKeys.includes(state.orden) ? state.orden : null },
    items: shown,
    total: sorted.length,
    hasMore: shown.length < sorted.length,
    facets,
    fragranceFree,
    priceBounds,
    sorts: sortKeys.map((value) => ({ value, label: SORT_LABELS[value] })),
    sort,
  }
}
