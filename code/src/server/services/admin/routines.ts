// Curated routines in the panel (RUT-01): steps with a main product, up to 2
// alternatives, instruction, frequency and optional flag; draft or published;
// discount and its mode (RUT-02, RUT-04). Saving runs the checks of RUT-05
// and RUT-06 and returns their warnings: they warn, they do not block.
import { z } from 'zod'
import type { Moment, Prisma, PrismaClient, RoutineDifficulty, RoutineStepType } from '@prisma/client'
import { audit, type Actor } from '@/server/audit'
import { checkRoutine, type CheckStep, type RoutineWarning } from '@/lib/commerce/routine'

type Db = PrismaClient | Prisma.TransactionClient

export const stepSchema = z.object({
  moment: z.enum(['AM', 'PM', 'BOTH']),
  stepType: z.string(),
  title: z.string().trim().min(1, 'Cada paso necesita un título.').max(80),
  mainProduct: z.string().trim().min(1, 'Cada paso necesita su producto principal.'),
  alternatives: z.array(z.string().trim()).max(2, 'Hasta 2 alternativas por paso.'),
  instruction: z.string().trim().max(500).nullable(),
  frequency: z.string().trim().max(80).nullable(),
  optional: z.boolean(),
})

export const routineSchema = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Minúsculas, números y guiones.'),
  name: z.string().trim().min(1, 'Este dato es obligatorio.').max(120),
  goal: z.string().trim().min(1, 'Este dato es obligatorio.').max(200),
  moment: z.enum(['AM', 'PM', 'BOTH']),
  difficulty: z.enum(['BASIC', 'INTERMEDIATE', 'COMPLETE']).nullable(),
  discountPct: z.number().int().min(0).max(100).nullable(),
  discountHalves: z.boolean(),
  description: z.string().trim().max(4000).nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  skinTypes: z.array(z.string()),
  concerns: z.array(z.string()),
  steps: z.array(stepSchema).min(1, 'La rutina necesita al menos un paso.'),
})
export type RoutineInput = z.infer<typeof routineSchema>

/** RUT-05, RUT-06 for a routine as saved. */
export async function routineWarnings(db: Db, routineId: string): Promise<RoutineWarning[]> {
  const r = await db.routine.findUnique({
    where: { id: routineId },
    include: {
      skinTypes: { include: { skinType: { select: { code: true } } } },
      steps: { orderBy: { position: 'asc' }, include: { mainProduct: { select: { name: true, ingredients: { include: { ingredient: { select: { id: true, commonName: true, isIrritant: true, familyId: true } } } } } } } },
    },
  })
  if (!r) return []
  const steps: CheckStep[] = r.steps.map((s) => ({
    position: s.position,
    moment: s.moment,
    frequency: s.frequency,
    product: { name: s.mainProduct.name, ingredients: s.mainProduct.ingredients.map((pi) => ({ id: pi.ingredient.id, name: pi.ingredient.commonName, irritant: pi.ingredient.isIrritant, familyIds: pi.ingredient.familyId ? [pi.ingredient.familyId] : [] })) },
  }))
  const ingredientIds = [...new Set(steps.flatMap((s) => s.product.ingredients.map((i) => i.id)))]
  const familyIds = [...new Set(steps.flatMap((s) => s.product.ingredients.flatMap((i) => i.familyIds)))]
  const [ingConflicts, famConflicts, families] = await Promise.all([
    db.ingredientConflict.findMany({ where: { ingredientAId: { in: ingredientIds }, ingredientBId: { in: ingredientIds } } }),
    db.familyConflict.findMany({ where: { familyAId: { in: familyIds }, familyBId: { in: familyIds } } }),
    db.ingredientFamily.findMany({ where: { id: { in: familyIds } } }),
  ])
  return checkRoutine(
    steps,
    {
      ingredients: ingConflicts.map((c) => ({ a: c.ingredientAId, b: c.ingredientBId, severity: c.severity, note: c.note })),
      families: famConflicts.map((c) => ({ a: c.familyAId, b: c.familyBId, severity: c.severity, note: c.note })),
    },
    families.map((f) => ({ id: f.id, name: f.name, noDuplicate: f.noDuplicate })),
    r.skinTypes.some((s) => s.skinType.code === 'sensible'),
  )
}

export type SaveRoutineResult = { ok: true; code: string; warnings: RoutineWarning[] } | { ok: false; error: string; field?: string }

export async function saveRoutine(db: PrismaClient, actor: Actor, existingCode: string | null, input: RoutineInput): Promise<SaveRoutineResult> {
  const codes = [...new Set(input.steps.flatMap((s) => [s.mainProduct, ...s.alternatives]).filter(Boolean))]
  const products = await db.product.findMany({ where: { code: { in: codes }, deletedAt: null }, select: { id: true, code: true, type: true, routineStep: true, name: true } })
  const byCode = new Map(products.map((p) => [p.code, p]))
  for (const [i, s] of input.steps.entries()) {
    for (const code of [s.mainProduct, ...s.alternatives]) {
      const p = byCode.get(code)
      if (!p) return { ok: false, error: `Paso ${i + 1}: no hay un producto con el código ${code}.`, field: `steps.${i}` }
      // CAT-07: only "Producto" enters routines and the engine; kits and travel sizes do not.
      if (p.type !== 'PRODUCT') return { ok: false, error: `Paso ${i + 1}: ${p.name} es un kit o un tamaño de viaje; las rutinas usan productos.`, field: `steps.${i}` }
    }
    if (s.alternatives.includes(s.mainProduct)) return { ok: false, error: `Paso ${i + 1}: la alternativa repite el producto principal.`, field: `steps.${i}` }
  }
  const [skinTypes, concerns] = await Promise.all([
    db.skinType.findMany({ where: { code: { in: input.skinTypes } }, select: { id: true } }),
    db.concern.findMany({ where: { code: { in: input.concerns } }, select: { id: true } }),
  ])
  if (input.code !== existingCode && (await db.routine.count({ where: { code: input.code } }))) return { ok: false, error: 'Ya hay una rutina con ese código.', field: 'code' }

  const routineId = await db.$transaction(async (tx) => {
    const data = {
      code: input.code,
      name: input.name,
      goal: input.goal,
      moment: input.moment as Moment,
      difficulty: input.difficulty as RoutineDifficulty | null,
      discountPct: input.discountPct,
      discountHalves: input.discountHalves,
      description: input.description,
      status: input.status,
    }
    const before = existingCode ? await tx.routine.findUnique({ where: { code: existingCode }, include: { steps: true } }) : null
    const routine = before ? await tx.routine.update({ where: { id: before.id }, data }) : await tx.routine.create({ data })
    await tx.routineSkinType.deleteMany({ where: { routineId: routine.id } })
    await tx.routineConcern.deleteMany({ where: { routineId: routine.id } })
    if (skinTypes.length) await tx.routineSkinType.createMany({ data: skinTypes.map((s) => ({ routineId: routine.id, skinTypeId: s.id })) })
    if (concerns.length) await tx.routineConcern.createMany({ data: concerns.map((c) => ({ routineId: routine.id, concernId: c.id })) })
    await tx.routineStep.deleteMany({ where: { routineId: routine.id } })
    for (const [i, s] of input.steps.entries()) {
      await tx.routineStep.create({
        data: {
          routineId: routine.id,
          position: i + 1,
          moment: s.moment as Moment,
          stepType: (s.stepType || byCode.get(s.mainProduct)!.routineStep) as RoutineStepType,
          title: s.title,
          mainProductId: byCode.get(s.mainProduct)!.id,
          instruction: s.instruction,
          frequency: s.frequency,
          optional: s.optional,
          alternatives: { create: s.alternatives.map((code, k) => ({ productId: byCode.get(code)!.id, position: k + 1 })) },
        },
      })
    }
    await audit(tx, actor, { action: before ? 'update' : 'create', entityType: 'Routine', entityId: routine.id, label: routine.name, after: input })
    return routine.id
  })
  return { ok: true, code: input.code, warnings: await routineWarnings(db, routineId) }
}
