// The seed dataset in the exact shape the Prisma queries return, for running
// without a database. Same data the seed script writes, so pages render the
// same either way. Ids are slugs.
import {
  brands,
  concerns as seedConcerns,
  conflicts as seedConflicts,
  ingredients as seedIngredients,
  products as seedProducts,
  skinTypes as seedSkinTypes,
  type Suitability,
} from '../../../prisma/seed/data'
import { productImage } from '@/lib/images'
import type { CatalogConflict, CatalogProduct } from './catalog'

function build() {
  const brandBySlug = new Map(brands.map((b) => [b.slug, { id: b.slug, slug: b.slug, name: b.name }]))
  const skinTypes = seedSkinTypes.map((s) => ({ id: s.slug, slug: s.slug, name: s.name }))
  const concerns = seedConcerns.map((c) => ({ id: c.slug, slug: c.slug, name: c.name, shortLabel: c.shortLabel, description: c.description }))
  const ingredientBySlug = new Map(seedIngredients.map((i) => [i.slug, { id: i.slug, ...i }]))
  const concernBySlug = new Map(concerns.map((c) => [c.slug, c]))
  const need = <T>(map: Map<string, T>, key: string): T => {
    const v = map.get(key)
    if (!v) throw new Error(`Sample catalog: unknown "${key}"`)
    return v
  }

  const products: CatalogProduct[] = seedProducts
    .map((p) => {
      const suitability = (slug: string): Suitability =>
        p.ideal.includes(slug) ? 'IDEAL' : p.notRecommended.includes(slug) ? 'NOT_RECOMMENDED' : 'SUITABLE'
      return {
        id: p.slug,
        slug: p.slug,
        name: p.name,
        brandId: p.brand,
        brand: need(brandBySlug, p.brand),
        shortDescription: p.shortDescription,
        description: p.description,
        whyWeChose: p.whyWeChose,
        ourRating: p.ourRating,
        ratingNotes: p.ratingNotes,
        howToUse: p.howToUse,
        precautions: p.precautions,
        texture: p.texture,
        fragranceFree: p.fragranceFree,
        routineStepType: p.stepType,
        routineMoment: p.moment,
        sizeLabel: p.sizeLabel,
        priceCents: p.priceCents,
        color: productImage(p.slug)?.color ?? p.color,
        avgRating: p.avgRating,
        reviewCount: p.reviewCount,
        skinTypes: skinTypes.map((s) => ({ productId: p.slug, skinTypeId: s.id, suitability: suitability(s.slug), skinType: s })),
        concerns: Object.entries(p.concerns)
          .map(([slug, relevance]) => ({ productId: p.slug, concernId: slug, relevance, concern: need(concernBySlug, slug) }))
          .sort((a, b) => b.relevance - a.relevance),
        ingredients: p.inci.map((entry, position) => {
          const [slug, opts] = typeof entry === 'string' ? [entry, {}] : entry
          return {
            productId: p.slug,
            ingredientId: slug,
            isKeyActive: opts.key ?? false,
            concentration: opts.conc ?? null,
            position,
            ingredient: need(ingredientBySlug, slug),
          }
        }),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const conflicts: CatalogConflict[] = seedConflicts.map((c) => ({
    id: `${c.a}:${c.b}`,
    ingredientAId: c.a,
    ingredientBId: c.b,
    severity: c.severity,
    note: c.note,
    ingredientA: need(ingredientBySlug, c.a),
    ingredientB: need(ingredientBySlug, c.b),
  }))

  return { products, conflicts, concerns: [...concerns].sort((a, b) => a.name.localeCompare(b.name, 'es')), skinTypes }
}

let cached: ReturnType<typeof build> | undefined
export function sampleCatalog() {
  return (cached ??= build())
}
