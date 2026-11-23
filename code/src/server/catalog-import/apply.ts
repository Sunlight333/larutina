// Writes a validated catalog in one transaction (CAT-02: all or nothing).
// Records are matched by code or SKU: new ones are created, existing ones
// updated. For every product and routine in the file, its lists (ingredients,
// needs, skin types, relations, steps) are replaced by the file's. Nothing is
// deleted that the file does not mention. New products and routines land in
// draft; existing ones keep the status set in the panel.
import type { Prisma, PrismaClient } from '@prisma/client'
import type { CatalogInput } from './validate'

type Tx = Prisma.TransactionClient
export type Counts = Record<string, { created: number; updated: number; inFile?: number }>

async function idMap(rows: Promise<{ id: string; code: string }[]>) {
  return new Map((await rows).map((r) => [r.code, r.id]))
}

export async function applyCatalog(db: PrismaClient, input: CatalogInput): Promise<Counts> {
  return db.$transaction(
    async (tx) => {
      const counts: Counts = {}
      const tally = (entity: string, created: boolean) => {
        counts[entity] ??= { created: 0, updated: 0 }
        counts[entity][created ? 'created' : 'updated']++
      }
      const codesOf = async (rows: Promise<{ code: string }[]>) => new Set((await rows).map((r) => r.code))

      // ---- taxonomies
      const brandCodes = await codesOf(tx.brand.findMany({ select: { code: true } }))
      for (const b of input.brands) {
        const data = { name: b.name, countryOfOrigin: b.countryOfOrigin, description: b.description, logoFile: b.logoFile, deletedAt: null }
        await tx.brand.upsert({ where: { code: b.code }, create: { code: b.code, ...data }, update: data })
        tally('Marcas', !brandCodes.has(b.code))
      }

      const categoryCodes = await codesOf(tx.category.findMany({ select: { code: true } }))
      for (const c of input.categories) {
        const data = { name: c.name, sortOrder: c.sortOrder, description: c.description, deletedAt: null }
        await tx.category.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data })
        tally('Categorias', !categoryCodes.has(c.code))
      }
      const categories = await idMap(tx.category.findMany({ select: { id: true, code: true } }))
      for (const c of input.categories) {
        await tx.category.update({ where: { code: c.code }, data: { parentId: c.parentCode ? categories.get(c.parentCode)! : null } })
      }

      const concernCodes = await codesOf(tx.concern.findMany({ select: { code: true } }))
      for (const c of input.concerns) {
        const data = { name: c.name, shortLabel: c.shortLabel, shortDescription: c.shortDescription, editorialContent: c.editorialContent, deletedAt: null }
        await tx.concern.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data })
        tally('Necesidades', !concernCodes.has(c.code))
      }
      const skinCodes = await codesOf(tx.skinType.findMany({ select: { code: true } }))
      for (const s of input.skinTypes) {
        const data = { name: s.name, description: s.description, deletedAt: null }
        await tx.skinType.upsert({ where: { code: s.code }, create: { code: s.code, ...data }, update: data })
        tally('TiposDePiel', !skinCodes.has(s.code))
      }
      const familyCodes = await codesOf(tx.ingredientFamily.findMany({ select: { code: true } }))
      for (const f of input.families) {
        const data = { name: f.name, warning: f.warning, excludableInDiagnosis: f.excludableInDiagnosis, noDuplicate: f.noDuplicate, computes: f.computes }
        await tx.ingredientFamily.upsert({ where: { code: f.code }, create: { code: f.code, ...data }, update: data })
        tally('Familias', !familyCodes.has(f.code))
      }
      const brands = await idMap(tx.brand.findMany({ select: { id: true, code: true } }))
      const concerns = await idMap(tx.concern.findMany({ select: { id: true, code: true } }))
      const skinTypes = await idMap(tx.skinType.findMany({ select: { id: true, code: true } }))
      const families = await idMap(tx.ingredientFamily.findMany({ select: { id: true, code: true } }))

      // ---- ingredients
      const ingredientCodes = await codesOf(tx.ingredient.findMany({ select: { code: true } }))
      for (const i of input.ingredients) {
        if (i.fromInci) {
          if (ingredientCodes.has(i.code)) continue
          await tx.ingredient.create({ data: { code: i.code, commonName: i.commonName, inciName: i.inciName, inciKey: i.inciKey, status: 'REVIEW' } })
          tally('Ingredientes', true)
          continue
        }
        const data = {
          commonName: i.commonName,
          inciName: i.inciName,
          inciKey: i.inciKey,
          isKeyActive: i.isKeyActive,
          isIrritant: i.isIrritant,
          description: i.description,
          familyId: i.familyCode ? families.get(i.familyCode)! : null,
          status: 'ACTIVE' as const,
          deletedAt: null,
        }
        await tx.ingredient.upsert({ where: { code: i.code }, create: { code: i.code, ...data }, update: data })
        tally('Ingredientes', !ingredientCodes.has(i.code))
      }
      const ingredients = await idMap(tx.ingredient.findMany({ select: { id: true, code: true } }))
      const sheetIngredients = input.ingredients.filter((i) => !i.fromInci)
      if (sheetIngredients.length) {
        await tx.ingredientConcern.deleteMany({ where: { ingredientId: { in: sheetIngredients.map((i) => ingredients.get(i.code)!) } } })
        await tx.ingredientConcern.createMany({
          data: sheetIngredients.flatMap((i) => i.concernCodes.map((c) => ({ ingredientId: ingredients.get(i.code)!, concernId: concerns.get(c)! }))),
        })
      }

      // ---- conflicts: one row per pair, whichever order it was written in
      for (const c of input.conflicts) {
        const a = ingredients.get(c.a)!
        const b = ingredients.get(c.b)!
        const removed = await tx.ingredientConflict.deleteMany({ where: { OR: [{ ingredientAId: a, ingredientBId: b }, { ingredientAId: b, ingredientBId: a }] } })
        await tx.ingredientConflict.create({ data: { ingredientAId: a, ingredientBId: b, severity: c.severity, note: c.note } })
        tally('Conflictos', removed.count === 0)
      }
      for (const c of input.familyConflicts) {
        const a = families.get(c.a)!
        const b = families.get(c.b)!
        const removed = await tx.familyConflict.deleteMany({ where: { OR: [{ familyAId: a, familyBId: b }, { familyAId: b, familyBId: a }] } })
        await tx.familyConflict.create({ data: { familyAId: a, familyBId: b, severity: c.severity, note: c.note } })
        tally('Conflictos_Familias', removed.count === 0)
      }

      // ---- products
      const productCodes = await codesOf(tx.product.findMany({ select: { code: true } }))
      for (const p of input.products) {
        const data = {
          name: p.name,
          brandId: brands.get(p.brandCode)!,
          categoryId: categories.get(p.categoryCode)!,
          type: p.type,
          shortDescription: p.shortDescription,
          description: p.description,
          benefits: p.benefits,
          whyWeChose: p.whyWeChose,
          evaluationScore: p.evaluationScore,
          evaluationNotes: p.evaluationNotes,
          howToUse: p.howToUse,
          precautions: p.precautions,
          texture: p.texture,
          textureDescription: p.textureDescription,
          tips: p.tips,
          routineStep: p.routineStep,
          moment: p.moment,
          durationDays: p.durationDays,
          level: p.level,
          priority: p.priority,
          kitContents: p.kitContents,
          line: p.line,
          headline: p.headline,
          chips: p.chips,
          labels: p.labels,
          vegan: p.vegan,
          crueltyFree: p.crueltyFree,
          dermatologistTested: p.dermatologistTested,
          sealSource: p.sealSource,
          anmatRegistration: p.anmatRegistration,
          importerHolder: p.importerHolder,
          countryOfOrigin: p.countryOfOrigin,
          paoMonths: p.paoMonths,
          vatRate: p.vatRate,
          inciText: p.inciText,
          images: p.images,
          videoUrl: p.videoUrl,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          fragranceFreeDeclared: p.fragranceFreeDeclared,
          ...p.flags,
          deletedAt: null,
        }
        await tx.product.upsert({ where: { code: p.code }, create: { code: p.code, status: 'DRAFT', ...data }, update: data })
        tally('Productos', !productCodes.has(p.code))
      }
      const products = await idMap(tx.product.findMany({ select: { id: true, code: true } }))
      const fileProductIds = input.products.map((p) => products.get(p.code)!)
      for (const p of input.products) {
        await tx.product.update({ where: { code: p.code }, data: { baseProductId: p.baseProductCode ? products.get(p.baseProductCode)! : null } })
      }
      await tx.productIngredient.deleteMany({ where: { productId: { in: fileProductIds } } })
      await tx.productIngredient.createMany({
        data: input.products.flatMap((p) =>
          p.ingredients.map((i) => ({ productId: products.get(p.code)!, ingredientId: ingredients.get(i.code)!, inciOrder: i.inciOrder, isStar: i.isStar, concentration: i.concentration })),
        ),
      })
      await tx.productConcern.deleteMany({ where: { productId: { in: fileProductIds } } })
      await tx.productConcern.createMany({
        data: input.products.flatMap((p) => p.concerns.map((c) => ({ productId: products.get(p.code)!, concernId: concerns.get(c.code)!, relevance: c.relevance }))),
      })
      await tx.productSkinType.deleteMany({ where: { productId: { in: fileProductIds } } })
      await tx.productSkinType.createMany({
        data: input.products.flatMap((p) => p.skinTypes.map((s) => ({ productId: products.get(p.code)!, skinTypeId: skinTypes.get(s.code)!, aptitude: s.aptitude }))),
      })
      await tx.productRelation.deleteMany({ where: { productId: { in: fileProductIds } } })
      await tx.productRelation.createMany({
        data: input.products.flatMap((p) =>
          p.relations.flatMap((rel) => rel.codes.map((code, position) => ({ productId: products.get(p.code)!, relatedId: products.get(code)!, kind: rel.kind, position }))),
        ),
      })

      // ---- variants
      const skus = await codesOf(tx.productVariant.findMany({ select: { sku: true } }).then((rows) => rows.map((r) => ({ code: r.sku }))))
      for (const v of input.variants) {
        const productId = products.get(v.productCode)!
        const data = {
          size: v.size,
          unit: v.unit,
          priceCents: v.priceCents,
          promoPriceCents: v.promoPriceCents,
          stock: v.stock,
          barcode: v.barcode,
          weightGrams: v.weightGrams,
          isMain: v.isMain,
          durationDays: v.durationDays,
          heightCm: v.heightCm,
          widthCm: v.widthCm,
          lengthCm: v.lengthCm,
          costCents: v.costCents,
        }
        await tx.productVariant.upsert({ where: { sku: v.sku }, create: { sku: v.sku, productId, ...data }, update: data })
        tally('Variantes', !skus.has(v.sku))
        // One main variant per product, also against variants not in the file.
        if (v.isMain) await tx.productVariant.updateMany({ where: { productId, sku: { not: v.sku }, isMain: true }, data: { isMain: false } })
      }

      // ---- routines
      const routineCodes = await codesOf(tx.routine.findMany({ select: { code: true } }))
      for (const r of input.routines) {
        const data = { name: r.name, goal: r.goal, moment: r.moment, difficulty: r.difficulty, discountPct: r.discountPct, description: r.description, deletedAt: null }
        const routine = await tx.routine.upsert({ where: { code: r.code }, create: { code: r.code, ...data }, update: data, select: { id: true } })
        tally('Rutinas', !routineCodes.has(r.code))
        await tx.routineSkinType.deleteMany({ where: { routineId: routine.id } })
        await tx.routineSkinType.createMany({ data: r.skinTypeCodes.map((c) => ({ routineId: routine.id, skinTypeId: skinTypes.get(c)! })) })
        await tx.routineConcern.deleteMany({ where: { routineId: routine.id } })
        await tx.routineConcern.createMany({ data: r.concernCodes.map((c) => ({ routineId: routine.id, concernId: concerns.get(c)! })) })
        await tx.routineStep.deleteMany({ where: { routineId: routine.id } })
        for (const s of r.steps) {
          await tx.routineStep.create({
            data: {
              routineId: routine.id,
              position: s.position,
              moment: s.moment,
              stepType: s.stepType,
              title: s.title,
              mainProductId: products.get(s.mainProductCode)!,
              instruction: s.instruction,
              frequency: s.frequency,
              optional: s.optional,
              alternatives: { create: s.alternativeCodes.map((code, position) => ({ productId: products.get(code)!, position })) },
            },
          })
        }
      }

      // ---- evaluation, endorsements, knowledge base, synonyms
      const criterionCodes = await codesOf(tx.evaluationCriterion.findMany({ select: { code: true } }))
      for (const c of input.criteria) {
        const data = { name: c.name, weight: c.weight, description: c.description }
        await tx.evaluationCriterion.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data })
        tally('Criterios', !criterionCodes.has(c.code))
      }
      const criteria = await idMap(tx.evaluationCriterion.findMany({ select: { id: true, code: true } }))
      for (const e of input.evaluations) {
        const key = { productId: products.get(e.productCode)!, criterionId: criteria.get(e.criterionCode)! }
        await tx.productEvaluation.upsert({ where: { productId_criterionId: key }, create: { ...key, score: e.score, note: e.note }, update: { score: e.score, note: e.note } })
        tally('Evaluacion', false)
      }
      const targets = [...new Set(input.endorsements.map((e) => `${e.targetType}|${e.targetCode}`))]
      for (const t of targets) {
        const [targetType, targetCode] = t.split('|') as ['PRODUCT' | 'ROUTINE', string]
        await tx.endorsement.deleteMany({ where: { targetType, targetCode } })
      }
      if (input.endorsements.length) await tx.endorsement.createMany({ data: input.endorsements })
      if (input.endorsements.length) counts['Avales'] = { created: input.endorsements.length, updated: 0 }

      const kbCodes = await codesOf(tx.knowledgeEntry.findMany({ select: { code: true } }))
      for (const k of input.knowledge) {
        const data = { category: k.category, question: k.question, answer: k.answer, keywords: k.keywords, active: k.active }
        await tx.knowledgeEntry.upsert({ where: { code: k.code }, create: { code: k.code, ...data }, update: data })
        tally('Base_Conocimiento', !kbCodes.has(k.code))
      }
      for (const s of input.synonyms) {
        const where = { type_targetCode_term: { type: s.type, targetCode: s.targetCode, term: s.term } }
        const before = await tx.synonym.findUnique({ where, select: { id: true } })
        await tx.synonym.upsert({ where, create: s, update: { variants: s.variants } })
        tally('Sinonimos', !before)
      }

      return counts
    },
    { maxWait: 10_000, timeout: 300_000 },
  )
}
