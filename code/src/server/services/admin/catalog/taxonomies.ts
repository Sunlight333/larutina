// Brands, categories and needs. Codes are set on creation and never change
// (CAT-01); deleting sends to the trash and is refused while live products
// (or routines, or subcategories) still use the record.
import { audit, changedFields } from '@/server/audit'
import { fail, newCodeProblem, ok, type Actor, type Db, type Result } from './common'
import { readTemplateFields, type FormInput } from './template-form'

const usedBy = (n: number, what: string) => `${n} ${what}`

// --------------------------------------------------------------- brands ----

const BRAND_FIELDS = { name: 'nombre', countryOfOrigin: 'pais_origen', description: 'descripcion' } as const

export async function saveBrand(db: Db, actor: Actor, code: string | null, input: FormInput & { logoFile?: string }): Promise<Result & { code?: string }> {
  const { values, errors } = readTemplateFields('Marcas', BRAND_FIELDS, input)
  const data = { name: values.name as string, countryOfOrigin: values.countryOfOrigin as string | null, description: values.description as string | null, logoFile: input.logoFile || null }
  if (code === null) {
    const newCode = (input.code ?? '').trim()
    const problem = await newCodeProblem(newCode, (c) => db.brand.findUnique({ where: { code: c } }))
    if (problem) errors.code = problem
    if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
    const brand = await db.$transaction(async (tx) => {
      const b = await tx.brand.create({ data: { code: newCode, ...data } })
      await audit(tx, actor, { action: 'create', entityType: 'Brand', entityId: b.id, label: b.name, after: { code: newCode, ...data } })
      return b
    })
    return { ...ok('Marca creada.'), code: brand.code }
  }
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  const before = await db.brand.findFirst({ where: { code, deletedAt: null } })
  if (!before) return fail('La marca no existe.')
  const diff = changedFields(before as unknown as Record<string, unknown>, data)
  if (!diff.changed) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.brand.update({ where: { id: before.id }, data })
    await audit(tx, actor, { action: 'update', entityType: 'Brand', entityId: before.id, label: data.name, before: diff.before, after: diff.after })
  })
  return ok('Marca guardada.')
}

export async function deleteBrand(db: Db, actor: Actor, code: string): Promise<Result> {
  const brand = await db.brand.findFirst({ where: { code, deletedAt: null } })
  if (!brand) return fail('La marca no existe.')
  const products = await db.product.count({ where: { brandId: brand.id, deletedAt: null } })
  if (products) return fail(`No se puede borrar: la usan ${usedBy(products, products === 1 ? 'producto' : 'productos')}. Cambiales la marca o borralos antes.`)
  await db.$transaction(async (tx) => {
    await tx.brand.update({ where: { id: brand.id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Brand', entityId: brand.id, label: brand.name })
  })
  return ok('Marca enviada a la papelera.')
}

// ----------------------------------------------------------- categories ----

const CATEGORY_FIELDS = { name: 'nombre', sortOrder: 'orden', description: 'descripcion' } as const

/** Ids of a category and everything under it, so a parent is never its own descendant. */
export async function categorySubtree(db: Db, id: string): Promise<Set<string>> {
  const all = await db.category.findMany({ select: { id: true, parentId: true } })
  const out = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const c of all)
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id)
        grew = true
      }
  }
  return out
}

export async function saveCategory(db: Db, actor: Actor, code: string | null, input: FormInput): Promise<Result & { code?: string }> {
  const { values, errors } = readTemplateFields('Categorias', CATEGORY_FIELDS, input)
  const parentId = (input.parentId ?? '').trim() || null
  if (parentId && !(await db.category.findFirst({ where: { id: parentId, deletedAt: null } }))) errors.parentId = 'La categoría padre no existe.'
  const data = { name: values.name as string, sortOrder: values.sortOrder as number | null, description: values.description as string | null, parentId }
  if (code === null) {
    const newCode = (input.code ?? '').trim()
    const problem = await newCodeProblem(newCode, (c) => db.category.findUnique({ where: { code: c } }))
    if (problem) errors.code = problem
    if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
    const created = await db.$transaction(async (tx) => {
      const c = await tx.category.create({ data: { code: newCode, ...data } })
      await audit(tx, actor, { action: 'create', entityType: 'Category', entityId: c.id, label: c.name, after: { code: newCode, ...data } })
      return c
    })
    return { ...ok('Categoría creada.'), code: created.code }
  }
  const before = await db.category.findFirst({ where: { code, deletedAt: null } })
  if (!before) return fail('La categoría no existe.')
  if (parentId && (await categorySubtree(db, before.id)).has(parentId)) errors.parentId = 'Una categoría no puede estar dentro de sí misma ni de una subcategoría suya.'
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  const diff = changedFields(before as unknown as Record<string, unknown>, data)
  if (!diff.changed) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.category.update({ where: { id: before.id }, data })
    await audit(tx, actor, { action: 'update', entityType: 'Category', entityId: before.id, label: data.name, before: diff.before, after: diff.after })
  })
  return ok('Categoría guardada.')
}

export async function deleteCategory(db: Db, actor: Actor, code: string): Promise<Result> {
  const category = await db.category.findFirst({ where: { code, deletedAt: null } })
  if (!category) return fail('La categoría no existe.')
  const [products, children] = await Promise.all([
    db.product.count({ where: { categoryId: category.id, deletedAt: null } }),
    db.category.count({ where: { parentId: category.id, deletedAt: null } }),
  ])
  if (products) return fail(`No se puede borrar: la usan ${usedBy(products, products === 1 ? 'producto' : 'productos')}. Cambiales la categoría antes.`)
  if (children) return fail(`No se puede borrar: tiene ${usedBy(children, children === 1 ? 'subcategoría' : 'subcategorías')}. Movelas o borralas antes.`)
  await db.$transaction(async (tx) => {
    await tx.category.update({ where: { id: category.id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Category', entityId: category.id, label: category.name })
  })
  return ok('Categoría enviada a la papelera.')
}

// --------------------------------------------------------------- needs ----

const CONCERN_FIELDS = { name: 'nombre', shortLabel: 'etiqueta_corta', shortDescription: 'descripcion_corta', editorialContent: 'contenido_editorial' } as const

export async function saveConcern(db: Db, actor: Actor, code: string | null, input: FormInput): Promise<Result & { code?: string }> {
  const { values, errors } = readTemplateFields('Necesidades', CONCERN_FIELDS, input)
  const data = { name: values.name as string, shortLabel: values.shortLabel as string, shortDescription: values.shortDescription as string | null, editorialContent: values.editorialContent as string | null }
  if (code === null) {
    const newCode = (input.code ?? '').trim()
    const problem = await newCodeProblem(newCode, (c) => db.concern.findUnique({ where: { code: c } }))
    if (problem) errors.code = problem
    if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
    const created = await db.$transaction(async (tx) => {
      const c = await tx.concern.create({ data: { code: newCode, ...data } })
      await audit(tx, actor, { action: 'create', entityType: 'Concern', entityId: c.id, label: c.name, after: { code: newCode, ...data } })
      return c
    })
    return { ...ok('Necesidad creada.'), code: created.code }
  }
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  const before = await db.concern.findFirst({ where: { code, deletedAt: null } })
  if (!before) return fail('La necesidad no existe.')
  const diff = changedFields(before as unknown as Record<string, unknown>, data)
  if (!diff.changed) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.concern.update({ where: { id: before.id }, data })
    await audit(tx, actor, { action: 'update', entityType: 'Concern', entityId: before.id, label: data.name, before: diff.before, after: diff.after })
  })
  return ok('Necesidad guardada.')
}

export async function deleteConcern(db: Db, actor: Actor, code: string): Promise<Result> {
  const concern = await db.concern.findFirst({ where: { code, deletedAt: null } })
  if (!concern) return fail('La necesidad no existe.')
  const [products, routines] = await Promise.all([
    db.productConcern.count({ where: { concernId: concern.id, product: { deletedAt: null } } }),
    db.routineConcern.count({ where: { concernId: concern.id, routine: { deletedAt: null } } }),
  ])
  if (products) return fail(`No se puede borrar: la usan ${usedBy(products, products === 1 ? 'producto' : 'productos')}. Sacala de sus necesidades antes.`)
  if (routines) return fail(`No se puede borrar: la usan ${usedBy(routines, routines === 1 ? 'rutina' : 'rutinas')}.`)
  await db.$transaction(async (tx) => {
    await tx.concern.update({ where: { id: concern.id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Concern', entityId: concern.id, label: concern.name })
  })
  return ok('Necesidad enviada a la papelera.')
}
