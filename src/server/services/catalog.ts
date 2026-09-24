import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { sampleCatalog } from './sample-catalog'
import type { EngineConflict, EngineProduct, Moment, Suitability } from '@/lib/diagnosis/engine'
import type { StepType } from '@/lib/diagnosis/copy'

const productInclude = {
  brand: true,
  skinTypes: { include: { skinType: true } },
  concerns: { include: { concern: true }, orderBy: { relevance: 'desc' } },
  ingredients: { include: { ingredient: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude

export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>

const conflictInclude = {
  ingredientA: true,
  ingredientB: true,
} satisfies Prisma.IngredientConflictInclude

export type CatalogConflict = Prisma.IngredientConflictGetPayload<{ include: typeof conflictInclude }>

/**
 * The whole demo catalog in one round trip per table. At 18 products this is
 * the right call; the real build reads through filtered queries (spec §6.1).
 * Deduplicated per render with React's cache().
 */
export const getCatalog = cache(async () => {
  if (!db) return sampleCatalog()
  const [products, conflicts, concerns, skinTypes] = await Promise.all([
    db.product.findMany({ include: productInclude, orderBy: { name: 'asc' } }),
    db.ingredientConflict.findMany({ include: conflictInclude }),
    db.concern.findMany({ orderBy: { name: 'asc' } }),
    db.skinType.findMany(),
  ])
  return { products, conflicts, concerns, skinTypes }
})

/**
 * Used by generateStaticParams. An empty catalog would otherwise build a site
 * with no product pages and no error, so it stops the build instead.
 */
export async function getProductSlugs(): Promise<string[]> {
  if (!db) return sampleCatalog().products.map((p) => p.slug)
  const rows = await db.product.findMany({ select: { slug: true } })
  if (rows.length === 0) {
    throw new Error(
      'The database has no products. Run `npx prisma migrate deploy` and `npm run db:seed` against it before building.',
    )
  }
  return rows.map((r) => r.slug)
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
 * The filtered catalog (spec §6.1). With PostgreSQL this is the EXISTS query:
 * OR within a facet, AND across facets, and a skin type matches products that
 * are IDEAL or SUITABLE for it. Without a database the same rules run in
 * memory. Ordered by relevance to the chosen concerns, then by routine step.
 */
export async function listProducts(filter: ProductFilter): Promise<CatalogProduct[]> {
  const { products } = await getCatalog()
  let ids: Set<string>

  if (db) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      WHERE (cardinality(${filter.concerns}::text[]) = 0 OR EXISTS (
              SELECT 1 FROM product_concerns pc
              JOIN concerns c ON c.id = pc.concern_id
              WHERE pc.product_id = p.id
                AND c.slug = ANY(${filter.concerns}::text[])
                AND pc.relevance >= ${MIN_RELEVANCE}))
        AND (cardinality(${filter.skinTypes}::text[]) = 0 OR EXISTS (
              SELECT 1 FROM product_skin_types pst
              JOIN skin_types st ON st.id = pst.skin_type_id
              WHERE pst.product_id = p.id
                AND st.slug = ANY(${filter.skinTypes}::text[])
                AND pst.suitability IN ('IDEAL', 'SUITABLE')))`
    ids = new Set(rows.map((r) => r.id))
  } else {
    ids = new Set(
      products
        .filter(
          (p) =>
            (filter.concerns.length === 0 || p.concerns.some((c) => filter.concerns.includes(c.concern.slug) && c.relevance >= MIN_RELEVANCE)) &&
            (filter.skinTypes.length === 0 ||
              p.skinTypes.some((s) => filter.skinTypes.includes(s.skinType.slug) && (s.suitability === 'IDEAL' || s.suitability === 'SUITABLE'))),
        )
        .map((p) => p.id),
    )
  }

  const relevance = (p: CatalogProduct) =>
    Math.max(0, ...p.concerns.filter((c) => filter.concerns.includes(c.concern.slug)).map((c) => c.relevance))
  return products
    .filter((p) => ids.has(p.id))
    .sort(
      (a, b) =>
        relevance(b) - relevance(a) ||
        STEP_ORDER.indexOf(a.routineStepType) - STEP_ORDER.indexOf(b.routineStepType) ||
        a.name.localeCompare(b.name, 'es'),
    )
}
