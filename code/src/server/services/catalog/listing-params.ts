// The listing state lives in the URL (NAV-02: "la URL conserva el estado").
// Parsing and building those URLs is pure, shared by the server page and the
// client filter form. Several values of one filter repeat the parameter
// (?piel=seca&piel=mixta), which is what a plain GET form sends.

export const SORT_LABELS = {
  recomendados: 'Recomendados',
  'precio-asc': 'Precio: de menor a mayor',
  'precio-desc': 'Precio: de mayor a menor',
  novedades: 'Novedades',
  'mas-vendidos': 'Más vendidos',
  'mejor-valorados': 'Mejor valorados',
  relevancia: 'Más relevantes',
} as const
export type SortKey = keyof typeof SORT_LABELS

export const FILTER_GROUPS = ['piel', 'necesidad', 'tipo', 'marca', 'momento', 'sello'] as const
export type FilterGroup = (typeof FILTER_GROUPS)[number]

export const MOMENT_VALUES = { manana: 'AM', noche: 'PM' } as const
export const SEAL_VALUES = { vegano: 'vegan', 'cruelty-free': 'crueltyFree', testeado: 'dermatologistTested' } as const

export type ListingState = Record<FilterGroup, string[]> & {
  sinFragancia: boolean
  /** Whole pesos, as typed in the URL. */
  precioMin: number | null
  precioMax: number | null
  orden: SortKey | null
  pagina: number
}

export type RawSearchParams = Record<string, string | string[] | undefined>

const CODE = /^[a-z0-9][a-z0-9-]{0,79}$/
const MAX_VALUES = 30

function list(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v : v ? [v] : []
  return [...new Set(raw.flatMap((x) => x.split(',')).map((x) => x.trim().toLowerCase()).filter((x) => CODE.test(x)))].slice(0, MAX_VALUES)
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function pesos(v: string | string[] | undefined): number | null {
  const s = first(v)?.replace(/[^\d]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n >= 0 && n < 1e9 ? n : null
}

export function emptyListingState(): ListingState {
  return { piel: [], necesidad: [], tipo: [], marca: [], momento: [], sello: [], sinFragancia: false, precioMin: null, precioMax: null, orden: null, pagina: 1 }
}

export function parseListingState(sp: RawSearchParams): ListingState {
  const orden = first(sp.orden)
  const pagina = Number(first(sp.pagina))
  return {
    piel: list(sp.piel),
    necesidad: list(sp.necesidad),
    tipo: list(sp.tipo),
    marca: list(sp.marca),
    momento: list(sp.momento).filter((m) => m in MOMENT_VALUES),
    sello: list(sp.sello).filter((m) => m in SEAL_VALUES),
    sinFragancia: ['1', 'si', 'true', 'on'].includes(first(sp.sin_fragancia) ?? ''),
    precioMin: pesos(sp.precio_min),
    precioMax: pesos(sp.precio_max),
    orden: orden && orden in SORT_LABELS ? (orden as SortKey) : null,
    pagina: Number.isInteger(pagina) && pagina > 1 && pagina < 1000 ? pagina : 1,
  }
}

/** The query string for a state; `extra` keeps parameters such as the search term. */
export function listingQuery(state: ListingState, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(extra)) if (v) q.append(k, v)
  for (const g of FILTER_GROUPS) for (const v of state[g]) q.append(g, v)
  if (state.sinFragancia) q.set('sin_fragancia', '1')
  if (state.precioMin != null) q.set('precio_min', String(state.precioMin))
  if (state.precioMax != null) q.set('precio_max', String(state.precioMax))
  if (state.orden) q.set('orden', state.orden)
  if (state.pagina > 1) q.set('pagina', String(state.pagina))
  return q.toString()
}

export function listingHref(basePath: string, state: ListingState, extra?: Record<string, string>): string {
  const q = listingQuery(state, extra)
  return q ? `${basePath}?${q}` : basePath
}

/** A change of filters always goes back to the first page. */
export function patchState(state: ListingState, patch: Partial<ListingState>): ListingState {
  return { ...state, pagina: 1, ...patch }
}

export function hasFilters(s: ListingState): boolean {
  return FILTER_GROUPS.some((g) => s[g].length > 0) || s.sinFragancia || s.precioMin != null || s.precioMax != null
}

export function clearFilters(s: ListingState): ListingState {
  return { ...emptyListingState(), orden: s.orden }
}
