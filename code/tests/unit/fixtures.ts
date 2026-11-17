// Builds engine inputs straight from the seed dataset, so the tests exercise
// the same catalog the demo ships with. Product ids are the slugs.
import { conflicts, ingredients, products, type Suitability } from '../../prisma/seed/data'
import type { EngineConflict, EngineProduct } from '../../src/lib/diagnosis/engine'

const ingredientBySlug = new Map(ingredients.map((i) => [i.slug, i]))
const SKIN_TYPES = ['seca', 'grasa', 'mixta', 'normal', 'sensible']

export const engineProducts: EngineProduct[] = products.map((p) => ({
  id: p.slug,
  slug: p.slug,
  name: p.name,
  stepType: p.stepType,
  moment: p.moment,
  priceCents: p.priceCents,
  suitability: Object.fromEntries(
    SKIN_TYPES.map((s): [string, Suitability] => [s, p.ideal.includes(s) ? 'IDEAL' : p.notRecommended.includes(s) ? 'NOT_RECOMMENDED' : 'SUITABLE']),
  ),
  concernRelevance: p.concerns,
  ingredients: p.inci.map((entry) => {
    const [slug, opts] = typeof entry === 'string' ? [entry, {}] : entry
    const ing = ingredientBySlug.get(slug)!
    return {
      slug,
      commonName: ing.commonName,
      featured: opts.key ?? false,
      isKeyActive: ing.isKeyActive,
      isIrritant: ing.isIrritant,
      concentration: opts.conc ?? null,
    }
  }),
}))

export const engineConflicts: EngineConflict[] = conflicts.map((c) => ({ ...c }))
