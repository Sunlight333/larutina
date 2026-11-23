// The search provider in use: the in-memory index, built from the database
// and kept for a minute per server process. A product published in the panel
// is findable within that minute; the listing pages read the catalog per
// request and are never stale.
import type { PrismaClient } from '@prisma/client'
import { getDb } from '@/server/db'
import { loadSettings } from '@/server/settings'
import { loadCatalog, loadCategories } from '@/server/services/catalog/catalog'
import { recommendedOrder } from '@/server/services/catalog/listing'
import { publishedProductWhere } from '@/server/services/catalog/rules'
import { MemoryIndex, type FreeOf, type SearchData } from './memory'
import type { SearchProvider } from './types'

export type { SearchProvider, SearchResult, SuggestResult, SuggestGroup, Suggestion } from './types'

const TTL_MS = 60_000

export async function loadSearchData(db: PrismaClient): Promise<SearchData> {
  const settings = await loadSettings(db)
  const [catalog, rows, categories, brands, concerns, skinTypes, synonyms] = await Promise.all([
    loadCatalog(db, settings),
    // Ingredients and computed flags, which the listing snapshot leaves out.
    db.product.findMany({
      where: publishedProductWhere(),
      select: {
        code: true,
        fragranceFree: true,
        alcoholFree: true,
        parabenFree: true,
        siliconeFree: true,
        sulfateFree: true,
        essentialOilFree: true,
        type: true,
        ingredients: { select: { isStar: true, ingredient: { select: { id: true, code: true, deletedAt: true } } } },
        baseProduct: {
          select: {
            deletedAt: true,
            fragranceFree: true,
            alcoholFree: true,
            parabenFree: true,
            siliconeFree: true,
            sulfateFree: true,
            essentialOilFree: true,
            ingredients: { select: { isStar: true, ingredient: { select: { id: true, code: true, deletedAt: true } } } },
          },
        },
      },
    }),
    loadCategories(db),
    db.brand.findMany({ where: { deletedAt: null }, select: { code: true, name: true } }),
    db.concern.findMany({ where: { deletedAt: null }, select: { code: true, name: true, shortLabel: true } }),
    db.skinType.findMany({ where: { deletedAt: null }, select: { code: true, name: true } }),
    db.synonym.findMany({ select: { term: true, type: true, targetCode: true, variants: true } }),
  ])

  const extra = new Map(
    rows.map((r) => {
      // CAT-07: a travel size without its own INCI searches by its base product's.
      const src = r.type === 'TRAVEL_SIZE' && r.ingredients.length === 0 && r.baseProduct && !r.baseProduct.deletedAt ? r.baseProduct : r
      const ingredients = src.ingredients.filter((i) => !i.ingredient.deletedAt)
      const freeOf: FreeOf[] = []
      if (ingredients.length) {
        if (src.fragranceFree) freeOf.push('fragancia')
        if (src.alcoholFree) freeOf.push('alcohol')
        if (src.parabenFree) freeOf.push('parabenos')
        if (src.siliconeFree) freeOf.push('siliconas')
        if (src.sulfateFree) freeOf.push('sulfatos')
        if (src.essentialOilFree) freeOf.push('aceites-esenciales')
      }
      return [r.code, { ingredients, freeOf }] as const
    }),
  )
  const usedIngredients = new Set([...extra.values()].flatMap((e) => e.ingredients.map((i) => i.ingredient.id)))
  const ingredients = usedIngredients.size
    ? await db.ingredient.findMany({
        where: { id: { in: [...usedIngredients] }, deletedAt: null },
        select: { code: true, commonName: true, inciName: true, description: true, status: true },
      })
    : []

  const ordered = [...catalog].sort(recommendedOrder)
  const order = new Map(ordered.map((p, i) => [p.code, i]))
  return {
    products: catalog.map((p) => {
      const x = extra.get(p.code)
      return {
        code: p.code,
        name: p.name,
        brandCode: p.brand.code,
        brandName: p.brand.name,
        line: p.line,
        categoryPath: p.categoryPath,
        stepLabel: p.stepLabel,
        moment: p.moment,
        freeOf: x?.freeOf ?? [],
        skinTypes: p.skinTypes,
        concerns: p.concerns,
        ingredients: (x?.ingredients ?? []).map((i) => ({ code: i.ingredient.code, isStar: i.isStar })),
        order: order.get(p.code) ?? 0,
        detail: `${p.stepLabel} · ${p.brand.name}`,
      }
    }),
    brands,
    categories: categories.map((c) => ({ code: c.code, name: c.name })),
    concerns,
    skinTypes,
    ingredients: ingredients.map((i) => ({
      code: i.code,
      commonName: i.commonName,
      inciName: i.inciName,
      hasPage: i.status === 'ACTIVE' && !!i.description?.trim(),
    })),
    synonyms,
    relevance: settings['catalog.pdpRelevance'],
  }
}

type Cached = { index: MemoryIndex; at: number }
const g = globalThis as unknown as { __lrSearch?: { cached?: Cached; building?: Promise<MemoryIndex> } }
const state = (g.__lrSearch ??= {})

async function currentIndex(): Promise<MemoryIndex> {
  if (state.cached && Date.now() - state.cached.at < TTL_MS) return state.cached.index
  // One rebuild at a time; requests meanwhile wait for it, or keep using the
  // previous index if there is one.
  state.building ??= loadSearchData(getDb())
    .then((data) => {
      const index = new MemoryIndex(data)
      state.cached = { index, at: Date.now() }
      return index
    })
    .finally(() => {
      state.building = undefined
    })
  if (state.cached) {
    state.building.catch(() => {})
    return state.cached.index
  }
  return state.building
}

/** Drops the cached index (tests, or after a bulk catalog change). */
export function resetSearchIndex() {
  state.cached = undefined
}

export const memorySearch: SearchProvider = {
  async search(query, opts) {
    return (await currentIndex()).search(query, opts)
  },
  async suggest(query) {
    return (await currentIndex()).suggest(query)
  },
}

export function getSearchProvider(): SearchProvider {
  return memorySearch
}
