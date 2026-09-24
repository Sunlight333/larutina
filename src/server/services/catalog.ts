import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
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
  const [products, conflicts, concerns, skinTypes] = await Promise.all([
    db.product.findMany({ include: productInclude, orderBy: { name: 'asc' } }),
    db.ingredientConflict.findMany({ include: conflictInclude }),
    db.concern.findMany({ orderBy: { name: 'asc' } }),
    db.skinType.findMany(),
  ])
  return { products, conflicts, concerns, skinTypes }
})

export async function getProductSlugs(): Promise<string[]> {
  const rows = await db.product.findMany({ select: { slug: true } })
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
