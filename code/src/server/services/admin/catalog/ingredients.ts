// Ingredients. Those created from an INCI list arrive in "Revisar"
// (REVIEW) with the INCI name as common name; the team completes them and
// marks them reviewed. A family change recomputes the flags of every
// product that has the ingredient (CAT-08).
import type { IngredientStatus } from '@prisma/client'
import { audit, changedFields } from '@/server/audit'
import { inciKey } from '@/server/catalog-import/inci'
import { fail, newCodeProblem, ok, type Actor, type Db, type Result } from './common'
import { recomputeFlagsForIngredients } from './product-ingredients'
import { readTemplateFields, type FormInput } from './template-form'

const FIELDS = { commonName: 'nombre_comun', inciName: 'nombre_inci', description: 'descripcion' } as const

export async function saveIngredient(db: Db, actor: Actor, code: string | null, input: FormInput, wantedConcerns: string[] = []): Promise<Result & { code?: string }> {
  const { values, errors } = readTemplateFields('Ingredientes', FIELDS, input)
  const familyId = (input.familyId ?? '').trim() || null
  if (familyId && !(await db.ingredientFamily.findUnique({ where: { id: familyId } }))) errors.familyId = 'La familia no existe.'
  const isKeyActive = input.isKeyActive === 'on'
  const data = {
    commonName: values.commonName as string,
    inciName: values.inciName as string,
    inciKey: values.inciName ? inciKey(values.inciName as string) : '',
    description: values.description as string | null,
    isKeyActive,
    isIrritant: input.isIrritant === 'on',
    familyId,
  }
  const current = code === null ? null : await db.ingredient.findFirst({ where: { code, deletedAt: null }, include: { concerns: { select: { concernId: true } } } })
  if (code !== null && !current) return fail('El ingrediente no existe.')
  // INCI lists are matched by name: two live ingredients with the same INCI name would be ambiguous.
  if (data.inciKey) {
    const twin = await db.ingredient.findFirst({ where: { inciKey: data.inciKey, deletedAt: null, ...(current ? { id: { not: current.id } } : {}) }, select: { code: true } })
    if (twin) errors.inciName = `Ya hay un ingrediente con ese nombre INCI: "${twin.code}".`
  }
  const liveConcerns = new Set((await db.concern.findMany({ where: { deletedAt: null }, select: { id: true } })).map((c) => c.id))
  const concernIds = [...new Set(wantedConcerns)].filter((id) => liveConcerns.has(id)).sort()

  if (current === null) {
    const newCode = (input.code ?? '').trim()
    const problem = await newCodeProblem(newCode, (c) => db.ingredient.findUnique({ where: { code: c } }))
    if (problem) errors.code = problem
    if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
    const created = await db.$transaction(async (tx) => {
      const i = await tx.ingredient.create({ data: { code: newCode, ...data, status: 'ACTIVE', concerns: { create: concernIds.map((concernId) => ({ concernId })) } } })
      await audit(tx, actor, { action: 'create', entityType: 'Ingredient', entityId: i.id, label: `${i.commonName} (${i.inciName})`, after: { code: newCode, ...data, concernIds } })
      return i
    })
    return { ...ok('Ingrediente creado.'), code: created.code }
  }
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  const beforeConcerns = current.concerns.map((c) => c.concernId).sort()
  const diff = changedFields({ ...current, concernIds: beforeConcerns } as unknown as Record<string, unknown>, { ...data, concernIds })
  if (!diff.changed) return ok('No había cambios.')
  let recomputed = 0
  await db.$transaction(async (tx) => {
    await tx.ingredient.update({ where: { id: current.id }, data })
    await tx.ingredientConcern.deleteMany({ where: { ingredientId: current.id } })
    await tx.ingredientConcern.createMany({ data: concernIds.map((concernId) => ({ ingredientId: current.id, concernId })) })
    if (current.familyId !== familyId) recomputed = await recomputeFlagsForIngredients(tx, [current.id])
    await audit(tx, actor, { action: 'update', entityType: 'Ingredient', entityId: current.id, label: `${data.commonName} (${data.inciName})`, before: diff.before, after: diff.after })
  })
  return ok(recomputed ? `Ingrediente guardado. Se recalcularon los indicadores de ${recomputed} ${recomputed === 1 ? 'producto' : 'productos'}.` : 'Ingrediente guardado.')
}

/** "Marcar como revisado": the ingredient leaves REVIEW. */
export async function setIngredientStatus(db: Db, actor: Actor, code: string, status: IngredientStatus): Promise<Result> {
  const ing = await db.ingredient.findFirst({ where: { code, deletedAt: null } })
  if (!ing) return fail('El ingrediente no existe.')
  if (ing.status === status) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.ingredient.update({ where: { id: ing.id }, data: { status } })
    await audit(tx, actor, { action: status === 'ACTIVE' ? 'review' : 'update', entityType: 'Ingredient', entityId: ing.id, label: `${ing.commonName} (${ing.inciName})`, before: { status: ing.status }, after: { status } })
  })
  return ok(status === 'ACTIVE' ? 'Marcado como revisado.' : 'Marcado para revisar.')
}

export async function deleteIngredient(db: Db, actor: Actor, code: string): Promise<Result> {
  const ing = await db.ingredient.findFirst({ where: { code, deletedAt: null } })
  if (!ing) return fail('El ingrediente no existe.')
  const products = await db.productIngredient.count({ where: { ingredientId: ing.id, product: { deletedAt: null } } })
  if (products) return fail(`No se puede borrar: está en ${products} ${products === 1 ? 'producto' : 'productos'}. Sacalo de su lista INCI antes.`)
  await db.$transaction(async (tx) => {
    await tx.ingredient.update({ where: { id: ing.id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Ingredient', entityId: ing.id, label: `${ing.commonName} (${ing.inciName})` })
  })
  return ok('Ingrediente enviado a la papelera.')
}
