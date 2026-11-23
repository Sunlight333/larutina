// The demo storefront's catalog. It reads only the sample dataset bundled in
// src/demo/data.ts; the real catalog lives in PostgreSQL (prisma/schema.prisma)
// and replaces these pages in the Phase 1 storefront.
import { cache } from 'react'
import { sampleCatalog } from './sample-catalog'
import type { EngineConflict, EngineProduct, Moment, Suitability } from '@/lib/diagnosis/engine'
import type { StepType } from '@/lib/diagnosis/copy'

type Named = { id: string; slug: string; name: string }

export type CatalogConcern = Named & { shortLabel: string; description: string | null }

export type CatalogIngredient = {
  id: string
  slug: string
  inciName: string
  commonName: string
  description: string | null
  isKeyActive: boolean
  isIrritant: boolean
}

export type CatalogProduct = Named & {
  brandId: string
  brand: Named
  shortDescription: string
  description: string
  whyWeChose: string
  ourRating: number
  ratingNotes: string
  howToUse: string
  precautions: string | null
  texture: string
  fragranceFree: boolean
  routineStepType: string
  routineMoment: string
  sizeLabel: string
  priceCents: number
  color: string
  avgRating: number
  reviewCount: number
  skinTypes: { productId: string; skinTypeId: string; suitability: string; skinType: Named }[]
  concerns: { productId: string; concernId: string; relevance: number; concern: CatalogConcern }[]
  ingredients: {
    productId: string
    ingredientId: string
    isKeyActive: boolean
    concentration: string | null
    position: number
    ingredient: CatalogIngredient
  }[]
}

export type CatalogConflict = {
  id: string
  ingredientAId: string
  ingredientBId: string
  severity: string
  note: string
  ingredientA: CatalogIngredient
  ingredientB: CatalogIngredient
}

/** The whole demo catalog, deduplicated per render with React's cache(). */
export const getCatalog = cache(async () => sampleCatalog())

/** Used by generateStaticParams. */
export async function getProductSlugs(): Promise<string[]> {
  return sampleCatalog().products.map((p) => p.slug)
}

export function toEngineProduct(p: CatalogProduct): EngineProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    stepType: p.routineStepType as StepType,
    moment: p.routineMoment as Moment,
    priceCents: p.priceCents,
    suitability: Object.fromEntries(p.skinTypes.map((s) => [s.skinType.slug, s.suitability as Suitability])),
    concernRelevance: Object.fromEntries(p.concerns.map((c) => [c.concern.slug, c.relevance])),
    ingredients: p.ingredients.map((pi) => ({
      slug: pi.ingredient.slug,
      commonName: pi.ingredient.commonName,
      featured: pi.isKeyActive,
      isKeyActive: pi.ingredient.isKeyActive,
      isIrritant: pi.ingredient.isIrritant,
      concentration: pi.concentration,
    })),
  }
}

export function toEngineConflicts(conflicts: CatalogConflict[]): EngineConflict[] {
  return conflicts.map((c) => ({
    a: c.ingredientA.slug,
    b: c.ingredientB.slug,
    severity: c.severity as EngineConflict['severity'],
    note: c.note,
  }))
}

export type ProductFilter = { skinTypes: string[]; concerns: string[] }

// A concern filter lists products that actually work on it, the same bar the
// product page uses for its "para qué sirve" chips.
const MIN_RELEVANCE = 50
const STEP_ORDER = ['CLEANSER', 'TONER', 'EXFOLIANT', 'SERUM', 'TREATMENT', 'MOISTURIZER', 'SUNSCREEN']

/**
 * The filtered catalog: OR within a facet, AND across facets, and a skin type
 * matches products that are IDEAL or SUITABLE for it. Ordered by relevance to
 * the chosen concerns, then by routine step.
 */
export async function listProducts(filter: ProductFilter): Promise<CatalogProduct[]> {
  const { products } = await getCatalog()
  const relevance = (p: CatalogProduct) =>
    Math.max(0, ...p.concerns.filter((c) => filter.concerns.includes(c.concern.slug)).map((c) => c.relevance))
  return products
    .filter(
      (p) =>
        (filter.concerns.length === 0 || p.concerns.some((c) => filter.concerns.includes(c.concern.slug) && c.relevance >= MIN_RELEVANCE)) &&
        (filter.skinTypes.length === 0 ||
          p.skinTypes.some((s) => filter.skinTypes.includes(s.skinType.slug) && (s.suitability === 'IDEAL' || s.suitability === 'SUITABLE'))),
    )
    .sort(
      (a, b) =>
        relevance(b) - relevance(a) ||
        STEP_ORDER.indexOf(a.routineStepType) - STEP_ORDER.indexOf(b.routineStepType) ||
        a.name.localeCompare(b.name, 'es'),
    )
}
