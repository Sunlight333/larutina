// Seeds the demo catalog. Idempotent: wipes catalog tables and reinserts.
// Diagnoses are left alone so shared result links keep working after a reseed
// — they store product ids, so a reseed that changes ids would break them;
// run `npm run db:reset` for a fully clean database instead.
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { brands, concerns, conflicts, ingredients, products, skinTypes, type Suitability } from './data'

const db = new PrismaClient()

// Backdrop colours measured from the processed packshots, so the placeholder
// behind each image matches the photo exactly. Falls back to the seed hex.
function loadImageColors(): Record<string, string> {
  const file = path.join(process.cwd(), 'src/content/image-manifest.json')
  if (!existsSync(file)) return {}
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { color?: string }>
  return Object.fromEntries(
    Object.entries(manifest)
      .filter(([key, v]) => key.startsWith('products/') && v.color)
      .map(([key, v]) => [key.replace('products/', ''), v.color!]),
  )
}

async function main() {
  const colors = loadImageColors()

  const existing = await db.product.count()
  if (existing > 0) {
    const diagnoses = await db.diagnosis.count()
    if (diagnoses > 0) {
      console.log(`Catalog already seeded and ${diagnoses} diagnoses reference it. Use \`npm run db:reset\` to start clean.`)
      return
    }
  }

  await db.$transaction([
    db.productIngredient.deleteMany(),
    db.productConcern.deleteMany(),
    db.productSkinType.deleteMany(),
    db.ingredientConflict.deleteMany(),
    db.product.deleteMany(),
    db.ingredient.deleteMany(),
    db.concern.deleteMany(),
    db.skinType.deleteMany(),
    db.brand.deleteMany(),
  ])

  await db.brand.createMany({ data: [...brands] })
  await db.skinType.createMany({ data: [...skinTypes] })
  await db.concern.createMany({ data: [...concerns] })
  await db.ingredient.createMany({ data: ingredients })

  const brandId = new Map((await db.brand.findMany()).map((b) => [b.slug, b.id]))
  const skinTypeId = new Map((await db.skinType.findMany()).map((s) => [s.slug, s.id]))
  const concernId = new Map((await db.concern.findMany()).map((c) => [c.slug, c.id]))
  const ingredientId = new Map((await db.ingredient.findMany()).map((i) => [i.slug, i.id]))

  const need = <T>(map: Map<string, T>, key: string, kind: string): T => {
    const value = map.get(key)
    if (value === undefined) throw new Error(`Unknown ${kind} "${key}"`)
    return value
  }

  for (const c of conflicts) {
    await db.ingredientConflict.create({
      data: {
        ingredientAId: need(ingredientId, c.a, 'ingredient'),
        ingredientBId: need(ingredientId, c.b, 'ingredient'),
        severity: c.severity,
        note: c.note,
      },
    })
  }

  for (const p of products) {
    const suitability = (slug: string): Suitability =>
      p.ideal.includes(slug) ? 'IDEAL' : p.notRecommended.includes(slug) ? 'NOT_RECOMMENDED' : 'SUITABLE'

    await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        brandId: need(brandId, p.brand, 'brand'),
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
        color: colors[p.slug] ?? p.color,
        avgRating: p.avgRating,
        reviewCount: p.reviewCount,
        skinTypes: {
          create: skinTypes.map((s) => ({
            skinTypeId: need(skinTypeId, s.slug, 'skin type'),
            suitability: suitability(s.slug),
          })),
        },
        concerns: {
          create: Object.entries(p.concerns).map(([slug, relevance]) => ({
            concernId: need(concernId, slug, 'concern'),
            relevance,
          })),
        },
        ingredients: {
          create: p.inci.map((entry, position) => {
            const [slug, opts] = typeof entry === 'string' ? [entry, {}] : entry
            return {
              ingredientId: need(ingredientId, slug, 'ingredient'),
              isKeyActive: opts.key ?? false,
              concentration: opts.conc ?? null,
              position,
            }
          }),
        },
      },
    })
  }

  console.log(`Seeded ${brands.length} brands, ${ingredients.length} ingredients, ${conflicts.length} conflicts, ${products.length} products.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
