// The whole catalog as plain data keyed by business codes, without ids or
// timestamps: two snapshots are equal when the catalog did not change.
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'

const sortBy = <T>(rows: T[], key: (r: T) => string) => [...rows].sort((a, b) => key(a).localeCompare(key(b)))

export async function catalogSnapshot(db: PrismaClient) {
  const brands = await db.brand.findMany({ omit: { id: true, createdAt: true, updatedAt: true } })
  const categories = await db.category.findMany({ omit: { id: true, createdAt: true, updatedAt: true, parentId: true }, include: { parent: { select: { code: true } } } })
  const concerns = await db.concern.findMany({ omit: { id: true, createdAt: true, updatedAt: true } })
  const skinTypes = await db.skinType.findMany({ omit: { id: true, createdAt: true, updatedAt: true } })
  const families = await db.ingredientFamily.findMany({ omit: { id: true, createdAt: true, updatedAt: true } })
  const ingredients = await db.ingredient.findMany({
    omit: { id: true, createdAt: true, updatedAt: true, familyId: true },
    include: { family: { select: { code: true } }, concerns: { select: { concern: { select: { code: true } } } } },
  })
  const conflicts = await db.ingredientConflict.findMany({ select: { severity: true, note: true, ingredientA: { select: { code: true } }, ingredientB: { select: { code: true } } } })
  const familyConflicts = await db.familyConflict.findMany({ select: { severity: true, note: true, familyA: { select: { code: true } }, familyB: { select: { code: true } } } })
  const products = await db.product.findMany({
    omit: { id: true, createdAt: true, updatedAt: true, brandId: true, categoryId: true, baseProductId: true },
    include: {
      brand: { select: { code: true } },
      category: { select: { code: true } },
      baseProduct: { select: { code: true } },
      variants: { omit: { id: true, productId: true, createdAt: true, updatedAt: true }, orderBy: { sku: 'asc' } },
      ingredients: { select: { inciOrder: true, isStar: true, concentration: true, ingredient: { select: { code: true } } }, orderBy: { inciOrder: 'asc' } },
      concerns: { select: { relevance: true, concern: { select: { code: true } } } },
      skinTypes: { select: { aptitude: true, skinType: { select: { code: true } } } },
      relations: { select: { kind: true, position: true, related: { select: { code: true } } } },
      evaluations: { select: { score: true, note: true, criterion: { select: { code: true } } } },
    },
  })
  const routines = await db.routine.findMany({
    omit: { id: true, createdAt: true, updatedAt: true },
    include: {
      skinTypes: { select: { skinType: { select: { code: true } } } },
      concerns: { select: { concern: { select: { code: true } } } },
      steps: {
        omit: { id: true, routineId: true, mainProductId: true },
        include: { mainProduct: { select: { code: true } }, alternatives: { select: { position: true, product: { select: { code: true } } } } },
        orderBy: { position: 'asc' },
      },
    },
  })
  const criteria = await db.evaluationCriterion.findMany({ omit: { id: true } })
  const endorsements = await db.endorsement.findMany({ omit: { id: true, createdAt: true } })
  const knowledge = await db.knowledgeEntry.findMany({ omit: { id: true, createdAt: true, updatedAt: true } })
  const synonyms = await db.synonym.findMany({ omit: { id: true } })

  return JSON.parse(
    JSON.stringify({
      brands: sortBy(brands, (r) => r.code),
      categories: sortBy(categories, (r) => r.code),
      concerns: sortBy(concerns, (r) => r.code),
      skinTypes: sortBy(skinTypes, (r) => r.code),
      families: sortBy(families, (r) => r.code),
      ingredients: sortBy(ingredients, (r) => r.code).map((i) => ({ ...i, concerns: i.concerns.map((c) => c.concern.code).sort() })),
      conflicts: sortBy(conflicts, (c) => [c.ingredientA.code, c.ingredientB.code].sort().join('|')),
      familyConflicts: sortBy(familyConflicts, (c) => [c.familyA.code, c.familyB.code].sort().join('|')),
      products: sortBy(products, (r) => r.code).map((p) => ({
        ...p,
        concerns: sortBy(p.concerns, (c) => c.concern.code),
        skinTypes: sortBy(p.skinTypes, (s) => s.skinType.code),
        relations: sortBy(p.relations, (r) => `${r.kind}|${String(r.position).padStart(4, '0')}`),
        evaluations: sortBy(p.evaluations, (e) => e.criterion.code),
      })),
      routines: sortBy(routines, (r) => r.code).map((r) => ({
        ...r,
        skinTypes: r.skinTypes.map((s) => s.skinType.code).sort(),
        concerns: r.concerns.map((c) => c.concern.code).sort(),
        steps: r.steps.map((s) => ({ ...s, alternatives: sortBy(s.alternatives, (a) => String(a.position)) })),
      })),
      criteria: sortBy(criteria, (c) => c.code),
      endorsements: sortBy(endorsements, (e) => `${e.targetType}|${e.targetCode}|${e.entity}`),
      knowledge: sortBy(knowledge, (k) => k.code),
      synonyms: sortBy(synonyms, (s) => `${s.type}|${s.targetCode}|${s.term}`),
    }),
  ) as unknown
}

/**
 * The client's own sample, kept out of this public repository: CATALOG_SAMPLE
 * points at it, or the project documents next to the code folder.
 */
export function samplePath(): string | null {
  const candidates = [
    process.env.CATALOG_SAMPLE,
    path.resolve(import.meta.dirname, '../../../docs/deliverables/08-anexo-firmado-y-decisiones/LaRutina-Catalogo-Maestro-v1.1_Tonico.xlsx'),
  ]
  return candidates.find((c): c is string => !!c && existsSync(c)) ?? null
}
