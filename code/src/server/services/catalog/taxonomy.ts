// Taxonomy pages (NAV-05): category, need, brand and ingredient. Every page
// is generated from the catalog, so a new need or brand gets its page as
// soon as it is loaded, with no code.
import { cache } from 'react'
import type { PrismaClient } from '@prisma/client'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { resolveImages, type ResolvedImage } from '@/server/media'
import { getCatalog, getCategories, type CatalogItem, type CategoryNode } from './catalog'
import type { CategoryOption, ListingSettings, ListingTaxonomy, Named } from './listing'
import { publishedProductWhere } from './rules'

/** Needs in the panel's order (listing.concernOrder); the rest alphabetically after them. */
export function orderConcerns<T extends { code: string; name: string }>(concerns: T[], order: string[]): T[] {
  const pos = new Map(order.map((c, i) => [c, i]))
  return [...concerns].sort((a, b) => (pos.get(a.code) ?? 1e6) - (pos.get(b.code) ?? 1e6) || a.name.localeCompare(b.name, 'es'))
}

/** Parents first, each followed by its children, by the panel's order. */
export function treeOrder(categories: CategoryNode[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id))
  const children = new Map<string | null, CategoryNode[]>()
  for (const c of categories) {
    const parent = c.parentId && ids.has(c.parentId) ? c.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), c])
  }
  const out: CategoryNode[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null) => {
    for (const c of children.get(parent) ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
      walk(c.id)
    }
  }
  walk(null)
  return out
}

export const getListingSettings = cache(async (): Promise<ListingSettings> => {
  const s = await getSettings()
  return {
    pageSize: s['listing.pageSize'],
    relevance: s['catalog.pdpRelevance'],
    sealFilter: s['catalog.sealFilter'],
    bestSellers: s['listing.bestSellers'],
    topRated: s['listing.topRated'],
  }
})

export const getListingTaxonomy = cache(async (): Promise<ListingTaxonomy> => {
  const db = getDb()
  const s = await getSettings()
  const [skinTypes, concerns, categories, brands] = await Promise.all([
    db.skinType.findMany({ where: { deletedAt: null }, select: { code: true, name: true }, orderBy: { createdAt: 'asc' } }),
    db.concern.findMany({ where: { deletedAt: null }, select: { code: true, name: true } }),
    getCategories(),
    db.brand.findMany({ where: { deletedAt: null }, select: { code: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  return {
    skinTypes,
    concerns: orderConcerns(concerns, s['listing.concernOrder']),
    categories: treeOrder(categories).map((c): CategoryOption => ({ id: c.id, code: c.code, name: c.name, parentId: c.parentId })),
    brands,
  }
})

// ---------------------------------------------------------------- pages ----

export async function getCategoryPage(code: string) {
  const categories = await getCategories()
  const category = categories.find((c) => c.code === code)
  if (!category) return null
  const parent = category.parentId ? categories.find((c) => c.id === category.parentId) ?? null : null
  return { ...category, parent }
}

export async function getConcernPage(code: string) {
  return getDb().concern.findFirst({
    where: { code, deletedAt: null },
    select: { code: true, name: true, shortLabel: true, shortDescription: true, editorialContent: true },
  })
}

export type ConcernSummary = { code: string; name: string; shortLabel: string; shortDescription: string | null; count: number }

/** /necesidades: every need, in the panel's order, with how many products work it. */
export async function getConcernsIndex(): Promise<ConcernSummary[]> {
  const [rows, catalog, s] = await Promise.all([
    getDb().concern.findMany({ where: { deletedAt: null }, select: { code: true, name: true, shortLabel: true, shortDescription: true } }),
    getCatalog(),
    getSettings(),
  ])
  const min = s['catalog.pdpRelevance']
  return orderConcerns(rows, s['listing.concernOrder']).map((c) => ({
    ...c,
    count: catalog.filter((p) => p.concerns.some((x) => x.code === c.code && x.relevance >= min)).length,
  }))
}

export type BrandSummary = {
  code: string
  name: string
  description: string | null
  countryOfOrigin: string | null
  logo: ResolvedImage | null
  count: number
}

async function withLogos(db: PrismaClient, brands: { logoFile: string | null }[]) {
  return resolveImages(db, brands.map((b) => b.logoFile ?? '').filter(Boolean))
}

/** /marcas (S-32): brands with published products. */
export async function getBrandsIndex(): Promise<BrandSummary[]> {
  const db = getDb()
  const [brands, catalog] = await Promise.all([
    db.brand.findMany({
      where: { deletedAt: null, products: { some: publishedProductWhere() } },
      select: { code: true, name: true, description: true, countryOfOrigin: true, logoFile: true },
      orderBy: { name: 'asc' },
    }),
    getCatalog(),
  ])
  const logos = await withLogos(db, brands)
  return brands.map((b) => ({
    code: b.code,
    name: b.name,
    description: b.description,
    countryOfOrigin: b.countryOfOrigin,
    logo: b.logoFile ? logos.get(b.logoFile) ?? null : null,
    count: catalog.filter((p) => p.brand.code === b.code).length,
  }))
}

export async function getBrandPage(code: string) {
  const db = getDb()
  const brand = await db.brand.findFirst({
    where: { code, deletedAt: null },
    select: { code: true, name: true, description: true, countryOfOrigin: true, logoFile: true },
  })
  if (!brand) return null
  const logo = brand.logoFile ? (await withLogos(db, [brand])).get(brand.logoFile) ?? null : null
  return { ...brand, logo }
}

export type IngredientPage = {
  code: string
  commonName: string
  inciName: string
  description: string
  isKeyActive: boolean
  family: { name: string; warning: string | null } | null
  concerns: Named[]
  /** Products that carry it as a star ingredient come first. */
  products: CatalogItem[]
  starCodes: Set<string>
}

/**
 * An ingredient has a page once it has a description (05 §3: the star
 * ingredients have one). Ingredients created by an import ("nuevo · revisar")
 * never do until someone reviews them.
 */
export async function getIngredientPage(code: string): Promise<IngredientPage | null> {
  const db = getDb()
  const ing = await db.ingredient.findFirst({
    where: { code, deletedAt: null, status: 'ACTIVE', description: { not: null } },
    include: {
      family: { select: { name: true, warning: true } },
      concerns: { where: { concern: { deletedAt: null } }, select: { concern: { select: { code: true, name: true } } } },
      products: { select: { isStar: true, product: { select: { code: true, travelSizes: { select: { code: true } } } } } },
    },
  })
  if (!ing?.description?.trim()) return null
  const catalog = await getCatalog()
  // Travel sizes inherit their base's INCI (CAT-07), so they carry its ingredients too.
  const codes = new Map<string, boolean>()
  for (const pi of ing.products) {
    for (const c of [pi.product.code, ...pi.product.travelSizes.map((t) => t.code)]) codes.set(c, (codes.get(c) ?? false) || pi.isStar)
  }
  const starCodes = new Set([...codes].filter(([, star]) => star).map(([c]) => c))
  const products = catalog
    .filter((p) => codes.has(p.code))
    .sort((a, b) => Number(starCodes.has(b.code)) - Number(starCodes.has(a.code)) || a.name.localeCompare(b.name, 'es'))
  return {
    code: ing.code,
    commonName: ing.commonName,
    inciName: ing.inciName,
    description: ing.description,
    isKeyActive: ing.isKeyActive,
    family: ing.family,
    concerns: ing.concerns.map((c) => c.concern),
    products,
    starCodes,
  }
}

/** Codes of ingredients that have a page, to link them from the product page only when it exists (F-11). */
export async function ingredientPageCodes(db: PrismaClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await db.ingredient.findMany({
    where: { id: { in: ids }, deletedAt: null, status: 'ACTIVE', description: { not: null } },
    select: { code: true, description: true },
  })
  return new Set(rows.filter((r) => r.description?.trim()).map((r) => r.code))
}
