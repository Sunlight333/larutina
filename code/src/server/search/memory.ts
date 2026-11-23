// In-memory search over the published catalog (NAV-06). The catalog is
// hundreds of products, so the whole index fits in memory and a query is a
// scan of a few thousand terms. Everything a product can be found by is an
// "entity" (the product itself, its brand, line, category, needs, skin types,
// moment, ingredients) with one or more phrases, synonyms included. Each
// query word must be matched by some entity of the product (AND); the
// product's score adds the best match per word, weighted by entity kind.
import type { Aptitude, Moment, SynonymType } from '@prisma/client'
import { matchQuality, QUALITY } from './matcher'
import { fold, queryTokens, tokens } from './normalize'
import type { SearchOptions, SearchResult, SuggestGroup, SuggestResult, Suggestion } from './types'

export type SearchProduct = {
  code: string
  name: string
  brandCode: string
  brandName: string
  line: string | null
  categoryPath: string[]
  stepLabel: string
  moment: Moment
  /** Computed flags (CAT-08) behind "sin fragancia", "sin alcohol"…; only set when the product has an INCI list. */
  freeOf: FreeOf[]
  skinTypes: { code: string; aptitude: Aptitude }[]
  concerns: { code: string; relevance: number }[]
  ingredients: { code: string; isStar: boolean }[]
  /** Position in the recommended order: breaks ties between equal scores. */
  order: number
  /** For the suggestion line: "Sérum · AXIS-Y". */
  detail: string
}

export type SearchData = {
  products: SearchProduct[]
  brands: { code: string; name: string }[]
  categories: { code: string; name: string }[]
  concerns: { code: string; name: string; shortLabel: string }[]
  skinTypes: { code: string; name: string }[]
  ingredients: { code: string; commonName: string; inciName: string; hasPage: boolean }[]
  synonyms: { term: string; type: SynonymType; targetCode: string; variants: string[] }[]
  /** Minimum relevance for a product to count under a need (catalog.pdpRelevance). */
  relevance: number
}

export type FreeOf = 'fragancia' | 'alcohol' | 'parabenos' | 'siliconas' | 'sulfatos' | 'aceites-esenciales'

type Parsed = { freeOf: FreeOf[]; qTokens: string[]; matches: Map<number, number>[] }

type EntityKind = 'product' | 'brand' | 'line' | 'category' | 'concern' | 'skin' | 'moment' | 'ingredient'

type Entity = {
  id: number
  kind: EntityKind
  code: string
  label: string
  /** Token lists, one per phrase (name, short label, synonyms…). */
  phrases: string[][]
  /** Product index → weight of this entity for that product. */
  products: Map<number, number>
  href: string | null
}

const KIND_WEIGHT: Record<EntityKind, number> = {
  product: 10,
  brand: 8,
  line: 7,
  category: 6,
  concern: 5,
  skin: 4,
  ingredient: 4,
  moment: 3,
}

// "Momento (mañana o noche)": the words people use for each.
const MOMENT_PHRASES: Record<'AM' | 'PM', string[]> = {
  AM: ['mañana', 'de mañana', 'día', 'de día', 'diurno', 'diurna', 'am', 'rutina de mañana'],
  PM: ['noche', 'de noche', 'nocturno', 'nocturna', 'pm', 'rutina de noche'],
}

// "Sin alcohol" must not find the products with alcohol: these phrases are
// read as the computed flags instead of as words to match.
const FREE_OF: [RegExp, FreeOf][] = [
  [/\bsin\s+(fragancias?|perfumes?|aromas?|olor)\b/g, 'fragancia'],
  [/\bsin\s+alcohol(es)?\b/g, 'alcohol'],
  [/\bsin\s+parabenos?\b/g, 'parabenos'],
  [/\bsin\s+siliconas?\b/g, 'siliconas'],
  [/\bsin\s+sulfatos?\b/g, 'sulfatos'],
  [/\bsin\s+aceites?\s+esenciales?\b/g, 'aceites-esenciales'],
]

const SUGGEST_LIMITS = { productos: 6, necesidades: 3, ingredientes: 4, marcas: 3, categorias: 3 }
const GROUP_LABELS: Record<SuggestGroup['kind'], string> = {
  productos: 'Productos',
  necesidades: 'Necesidades',
  ingredientes: 'Ingredientes',
  marcas: 'Marcas',
  categorias: 'Categorías',
}

export class MemoryIndex {
  private entities: Entity[] = []
  private vocabulary = new Map<string, { entity: number; phrase: number }[]>()
  private products: SearchProduct[]

  constructor(private data: SearchData) {
    this.products = data.products
    this.build()
  }

  private add(kind: EntityKind, code: string, label: string, texts: string[], products: Map<number, number>, href: string | null) {
    const phrases = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].map(tokens).filter((p) => p.length > 0)
    if (!phrases.length) return
    const e: Entity = { id: this.entities.length, kind, code, label, phrases, products, href }
    this.entities.push(e)
    phrases.forEach((p, phrase) => {
      for (const t of new Set(p)) {
        const list = this.vocabulary.get(t) ?? []
        list.push({ entity: e.id, phrase })
        this.vocabulary.set(t, list)
      }
    })
    return e
  }

  private build() {
    const { products, relevance } = this.data
    const synonyms = (type: SynonymType, code: string) =>
      this.data.synonyms.filter((s) => s.type === type && s.targetCode === code).flatMap((s) => [s.term, ...s.variants])
    const where = (test: (p: SearchProduct) => number) => {
      const m = new Map<number, number>()
      products.forEach((p, i) => {
        const w = test(p)
        if (w > 0) m.set(i, w)
      })
      return m
    }

    products.forEach((p, i) => {
      this.add('product', p.code, p.name, [p.name, p.stepLabel], new Map([[i, 1]]), `/producto/${p.code}`)
    })
    for (const b of this.data.brands) {
      const m = where((p) => (p.brandCode === b.code ? 1 : 0))
      if (m.size) this.add('brand', b.code, b.name, [b.name, ...synonyms('BRAND', b.code)], m, `/marca/${b.code}`)
    }
    // Lines (CAT-15) are a free-text column: one entity per brand and line.
    const lines = new Map<string, { name: string; brand: string }>()
    for (const p of products) if (p.line) lines.set(`${p.brandCode}:${fold(p.line)}`, { name: p.line, brand: p.brandCode })
    for (const [key, l] of lines) {
      const m = where((p) => (p.line && `${p.brandCode}:${fold(p.line)}` === key ? 1 : 0))
      this.add('line', key, l.name, [l.name], m, null)
    }
    for (const c of this.data.categories) {
      const m = where((p) => (p.categoryPath[0] === c.code ? 1 : p.categoryPath.includes(c.code) ? 0.8 : 0))
      if (m.size) this.add('category', c.code, c.name, [c.name, ...synonyms('PRODUCT_TYPE', c.code)], m, `/categoria/${c.code}`)
    }
    for (const c of this.data.concerns) {
      const m = where((p) => {
        const r = p.concerns.find((x) => x.code === c.code)?.relevance ?? 0
        return r >= relevance ? r / 100 : 0
      })
      if (m.size) this.add('concern', c.code, c.name, [c.name, c.shortLabel, ...synonyms('CONCERN', c.code)], m, `/necesidad/${c.code}`)
    }
    for (const s of this.data.skinTypes) {
      const m = where((p) => {
        const a = p.skinTypes.find((x) => x.code === s.code)?.aptitude
        return a === 'IDEAL' ? 1 : a === 'SUITABLE' ? 0.7 : 0
      })
      if (m.size) this.add('skin', s.code, s.name, [s.name, `piel ${s.name}`, ...synonyms('SKIN_TYPE', s.code)], m, `/productos?piel=${s.code}`)
    }
    for (const moment of ['AM', 'PM'] as const) {
      const m = where((p) => (p.moment === moment ? 1 : p.moment === 'BOTH' ? 0.8 : 0))
      if (m.size) this.add('moment', moment, moment === 'AM' ? 'De mañana' : 'De noche', MOMENT_PHRASES[moment], m, `/productos?momento=${moment === 'AM' ? 'manana' : 'noche'}`)
    }
    for (const ing of this.data.ingredients) {
      const m = where((p) => {
        const x = p.ingredients.find((y) => y.code === ing.code)
        return x ? (x.isStar ? 1 : 0.35) : 0
      })
      if (m.size) {
        this.add('ingredient', ing.code, ing.commonName, [ing.commonName, ing.inciName, ...synonyms('INGREDIENT', ing.code)], m, ing.hasPage ? `/ingrediente/${ing.code}` : null)
      }
    }
  }

  /** For each query token, the entities it matches and how well (best phrase). */
  private matchTokens(qTokens: string[]): Map<number, number>[] {
    const vocab = [...this.vocabulary.keys()]
    return qTokens.map((t) => {
      const out = new Map<number, number>()
      const take = (term: string, q: number) => {
        for (const ref of this.vocabulary.get(term) ?? []) out.set(ref.entity, Math.max(out.get(ref.entity) ?? 0, q))
      }
      // Typos only when the word matches nothing as written: "seca" must
      // not also find "seda" when the catalog has "seca".
      let found = false
      for (const term of vocab) {
        const q = matchQuality(t, term, { typos: false })
        if (q > 0) {
          take(term, q)
          found = true
        }
      }
      if (!found) for (const term of vocab) if (matchQuality(t, term) === QUALITY.typo) take(term, QUALITY.typo)
      return out
    })
  }

  private parse(query: string): Parsed {
    let rest = fold(query)
    const freeOf: FreeOf[] = []
    for (const [re, flag] of FREE_OF) {
      if (rest.match(re)) {
        freeOf.push(flag)
        rest = rest.replace(re, ' ')
      }
    }
    const qTokens = queryTokens(rest)
    return { freeOf, qTokens, matches: this.matchTokens(qTokens) }
  }

  /** Products scored: every token must be matched by one of the product's entities (AND). */
  private scoreProducts(matches: Map<number, number>[], requireAll: boolean): Map<number, { score: number; hits: number }> {
    const scores = new Map<number, { score: number; hits: number }>()
    matches.forEach((m) => {
      const best = new Map<number, number>()
      for (const [entityId, quality] of m) {
        const e = this.entities[entityId]!
        for (const [pi, w] of e.products) {
          const s = quality * KIND_WEIGHT[e.kind] * w
          if (s > (best.get(pi) ?? 0)) best.set(pi, s)
        }
      }
      for (const [pi, s] of best) {
        const cur = scores.get(pi) ?? { score: 0, hits: 0 }
        scores.set(pi, { score: cur.score + s, hits: cur.hits + 1 })
      }
    })
    const need = requireAll ? matches.length : Math.ceil(matches.length / 2)
    for (const [pi, s] of scores) if (s.hits < need) scores.delete(pi)
    return scores
  }

  private bestConcern(matches: Map<number, number>[]) {
    let best: { e: Entity; score: number } | null = null
    const totals = new Map<number, number>()
    for (const m of matches) for (const [id, q] of m) if (this.entities[id]!.kind === 'concern' && q >= QUALITY.prefix) totals.set(id, (totals.get(id) ?? 0) + q)
    for (const [id, score] of totals) {
      const e = this.entities[id]!
      if (!best || score > best.score || (score === best.score && e.products.size > best.e.products.size)) best = { e, score }
    }
    return best ? { code: best.e.code, name: best.e.label } : null
  }

  search(query: string, opts: SearchOptions = {}): SearchResult {
    const clean = query.trim().slice(0, 100)
    return this.run(clean, this.parse(clean), opts)
  }

  private run(clean: string, parsed: Parsed, opts: SearchOptions): SearchResult {
    const { freeOf, qTokens, matches } = parsed
    if (!qTokens.length && !freeOf.length) return { query: clean, products: [], concern: null }
    let scores: Map<number, { score: number; hits: number }>
    if (qTokens.length) {
      scores = this.scoreProducts(matches, true)
      // Nothing matches every word: fall back to products matching most of
      // them, so "crema hidratante sedosa" still finds the creams.
      if (!scores.size && qTokens.length > 1) scores = this.scoreProducts(matches, false)
    } else {
      scores = new Map(this.products.map((_, i) => [i, { score: 1, hits: 1 }]))
    }
    const hits = [...scores]
      .filter(([pi]) => freeOf.every((f) => this.products[pi]!.freeOf.includes(f)))
      .sort((a, b) => b[1].hits - a[1].hits || b[1].score - a[1].score || this.products[a[0]]!.order - this.products[b[0]]!.order)
      .slice(0, opts.limit ?? 500)
      .map(([pi, s]) => ({ code: this.products[pi]!.code, score: Math.round(s.score * 100) / 100 }))
    return { query: clean, products: hits, concern: this.bestConcern(matches) }
  }

  suggest(query: string): SuggestResult {
    const clean = query.trim().slice(0, 100)
    const parsed = this.parse(clean)
    const result = this.run(clean, parsed, { limit: SUGGEST_LIMITS.productos })
    const { matches } = parsed
    const productIndex = new Map(this.products.map((p, i) => [p.code, i]))

    // Entities ranked by how many query words they cover, then how well.
    const coverage = new Map<number, { hits: number; quality: number }>()
    for (const m of matches) {
      for (const [id, q] of m) {
        const c = coverage.get(id) ?? { hits: 0, quality: 0 }
        coverage.set(id, { hits: c.hits + 1, quality: c.quality + q })
      }
    }
    const ranked = [...coverage]
      .map(([id, c]) => ({ e: this.entities[id]!, ...c }))
      .sort((a, b) => b.hits - a.hits || b.quality - a.quality || b.e.products.size - a.e.products.size || a.e.label.localeCompare(b.e.label, 'es'))

    const pick = (kind: EntityKind, limit: number): Suggestion[] =>
      ranked
        .filter((r) => r.e.kind === kind && r.e.href)
        .slice(0, limit)
        .map((r) => ({ id: `${kind}:${r.e.code}`, label: r.e.label, href: r.e.href!, detail: `${r.e.products.size} ${r.e.products.size === 1 ? 'producto' : 'productos'}` }))

    const products: Suggestion[] = result.products.map((h) => {
      const p = this.products[productIndex.get(h.code)!]!
      return { id: `producto:${p.code}`, label: p.name, detail: p.detail, href: `/producto/${p.code}` }
    })
    const groups: SuggestGroup[] = [
      { kind: 'productos' as const, items: products },
      { kind: 'necesidades' as const, items: pick('concern', SUGGEST_LIMITS.necesidades) },
      { kind: 'ingredientes' as const, items: pick('ingredient', SUGGEST_LIMITS.ingredientes) },
      { kind: 'marcas' as const, items: pick('brand', SUGGEST_LIMITS.marcas) },
      { kind: 'categorias' as const, items: pick('category', SUGGEST_LIMITS.categorias) },
    ]
      .filter((g) => g.items.length > 0)
      .map((g) => ({ ...g, label: GROUP_LABELS[g.kind] }))

    const concern = result.concern
    return { query: clean, groups, seeAll: concern ? { label: `Ver todo para ${concern.name}`, href: `/necesidad/${concern.code}` } : null }
  }
}
