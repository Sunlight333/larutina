// "Combina bien con" (block 10) and the conflict list of block 8, both derived
// from the same product data the diagnosis uses.
import type { EngineConflict, EngineProduct } from '@/lib/diagnosis/engine'
import type { StepType } from '@/lib/diagnosis/copy'

export const STEP_ORDER: StepType[] = ['CLEANSER', 'TONER', 'EXFOLIANT', 'SERUM', 'TREATMENT', 'MOISTURIZER', 'SUNSCREEN']

const featured = (p: EngineProduct) => new Set(p.ingredients.filter((i) => i.featured).map((i) => i.slug))

/** Conflicts between two products' featured actives, in either direction. */
export function conflictsBetween(a: EngineProduct, b: EngineProduct, conflicts: EngineConflict[]): EngineConflict[] {
  const fa = featured(a)
  const fb = featured(b)
  return conflicts.filter((c) => (fa.has(c.a) && fb.has(c.b)) || (fa.has(c.b) && fb.has(c.a)))
}

/** Every other product this one should not share a night with, grouped by conflict. */
export function productConflicts(target: EngineProduct, products: EngineProduct[], conflicts: EngineConflict[]) {
  const result: { conflict: EngineConflict; products: EngineProduct[] }[] = []
  for (const c of conflicts) {
    const others = products.filter((p) => p.id !== target.id && conflictsBetween(target, p, [c]).length > 0)
    if (others.length) result.push({ conflict: c, products: others })
  }
  return result
}

function momentsOverlap(a: EngineProduct, b: EngineProduct) {
  return a.moment === 'BOTH' || b.moment === 'BOTH' || a.moment === b.moment
}

export type Pairing = { product: EngineProduct; sharedConcerns: string[] }

/**
 * Two or three products from other routine steps that work on the same
 * concerns, suit the same skin, can be used at the same time of day, and do
 * not conflict. Ordered as they would be applied.
 */
export function pairings(target: EngineProduct, products: EngineProduct[], conflicts: EngineConflict[], limit = 3): Pairing[] {
  const idealSkins = Object.entries(target.suitability)
    .filter(([, s]) => s === 'IDEAL')
    .map(([skin]) => skin)

  const scored = products
    .filter((q) => q.id !== target.id && q.stepType !== target.stepType && momentsOverlap(target, q))
    .filter((q) => conflictsBetween(target, q, conflicts).length === 0)
    .filter((q) => idealSkins.every((s) => q.suitability[s] !== 'NOT_RECOMMENDED'))
    .map((q) => {
      const sharedConcerns = Object.keys(target.concernRelevance)
        .filter((c) => (q.concernRelevance[c] ?? 0) >= 40)
        .sort((a, b) => Math.min(target.concernRelevance[b]!, q.concernRelevance[b]!) - Math.min(target.concernRelevance[a]!, q.concernRelevance[a]!))
      const overlap = sharedConcerns.reduce((sum, c) => sum + Math.min(target.concernRelevance[c]!, q.concernRelevance[c]!), 0)
      const skinFit = idealSkins.filter((s) => q.suitability[s] === 'IDEAL').length * 12
      return { product: q, sharedConcerns, score: overlap + skinFit }
    })
    .filter((x) => x.sharedConcerns.length > 0)
    .sort((a, b) => b.score - a.score || a.product.priceCents - b.product.priceCents)

  const picked: typeof scored = []
  const steps = new Set<string>()
  for (const s of scored) {
    if (steps.has(s.product.stepType)) continue
    steps.add(s.product.stepType)
    picked.push(s)
    if (picked.length === limit) break
  }
  return picked
    .sort((a, b) => STEP_ORDER.indexOf(a.product.stepType) - STEP_ORDER.indexOf(b.product.stepType))
    .map(({ product, sharedConcerns }) => ({ product, sharedConcerns }))
}
