// The search boundary (06 §2: every external service behind an interface we
// own). Today it is an in-memory index; a hosted engine can replace it
// without touching the pages or the API.

export type SearchOptions = { limit?: number }

export type SearchHit = { code: string; score: number }

export type MatchedConcern = { code: string; name: string }

export type SearchResult = {
  query: string
  /** Product codes, best first. */
  products: SearchHit[]
  /** When the query names a need: the page with everything for it (NAV-06, G-05). */
  concern: MatchedConcern | null
}

export type SuggestionKind = 'productos' | 'necesidades' | 'ingredientes' | 'marcas' | 'categorias'

export type Suggestion = { id: string; label: string; detail?: string; href: string }

export type SuggestGroup = { kind: SuggestionKind; label: string; items: Suggestion[] }

export type SuggestResult = {
  query: string
  groups: SuggestGroup[]
  seeAll: { label: string; href: string } | null
}

export interface SearchProvider {
  search(query: string, opts?: SearchOptions): Promise<SearchResult>
  suggest(query: string): Promise<SuggestResult>
}
