// Products in the panel: list, create, edit, publish, status and trash.
//
// Draft rule (ADM-02). A product in Borrador is not on the site, so its
// "Datos" are edited in place. Once published, saving "Datos" writes the
// changed fields to Product.draft instead (Prisma field names, dates as
// YYYY-MM-DD): the site keeps showing the columns, the preview at
// /producto/[code]?vista-previa=1 overlays the draft, and "Publicar cambios"
// copies it to the columns. Everything else is operational or relational and
// applies at once, also when published: variants, prices, stock, images,
// video, status, ingredients (INCI and family flags), needs, skin types and
// relations. Every change is audited with the fields that changed.
import { Prisma, type Product, type ProductStatus, type ProductType } from '@prisma/client'
import { audit, changedFields } from '@/server/audit'
import { LISTS, labelOf } from '@/server/catalog-import/lists'
import { SHEETS } from '@/server/catalog-import/spec'
import { fail, newCodeProblem, ok, productLookups, type Actor, type Db, type Result, type Tx } from './common'
import { productCompleteness, type Completeness } from './completeness'
import { dataOf, diffValues, parseData, publishedStatus, readDraft, toPrismaData, type DataInput, type DataValues } from './product-fields'
import { parseVariant, skuProblem, type VariantInput } from './variants'

export const STATUS_OPTIONS = LISTS.estado.labels.map(([label, value]) => ({ value, label }))
export const TYPE_OPTIONS = LISTS.tipo_producto.labels.map(([label, value]) => ({ value, label }))
export const statusLabel = (s: ProductStatus) => labelOf(LISTS.estado, s)

// --------------------------------------------------------------- listing ----

export type ProductFilters = { q?: string; status?: string; brand?: string; category?: string; type?: string }

export function productWhere(f: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { deletedAt: null }
  const q = f.q?.trim()
  if (q)
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q.toLowerCase() } },
      { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
    ]
  if (f.status && LISTS.estado.labels.some(([, v]) => v === f.status)) where.status = f.status as ProductStatus
  if (f.brand) where.brand = { code: f.brand }
  if (f.category) where.category = { code: f.category }
  if (f.type && LISTS.tipo_producto.labels.some(([, v]) => v === f.type)) where.type = f.type as ProductType
  return where
}

const completenessInclude = {
  _count: { select: { ingredients: true, relations: { where: { kind: 'COMPLEMENTARY' } } } },
} satisfies Prisma.ProductInclude

/** The product with its pending draft on top: what it will look like once published. */
export const withDraft = (p: Product): Product => {
  const draft = readDraft(p.draft)
  return draft ? ({ ...p, ...toPrismaData(draft) } as Product) : p
}

export function completenessOf(p: Product & { _count: { ingredients: number; relations: number } }): Completeness {
  const merged = withDraft(p)
  return productCompleteness({ ...merged, ingredientCount: p._count.ingredients, complementaryCount: p._count.relations })
}

export async function listProducts(db: Db, filters: ProductFilters, page: { skip: number; take: number }) {
  const where = productWhere(filters)
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: page.skip,
      take: page.take,
      include: {
        brand: { select: { name: true } },
        variants: { select: { sku: true, isMain: true, priceCents: true, promoPriceCents: true, stock: true } },
        ...completenessInclude,
      },
    }),
  ])
  return {
    total,
    rows: rows.map((p) => {
      const main = p.variants.find((v) => v.isMain) ?? p.variants[0]
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand.name,
        status: p.status,
        type: p.type,
        image: p.images[0] ?? null,
        mainPriceCents: main?.priceCents ?? null,
        mainPromoCents: main?.promoPriceCents ?? null,
        stock: p.variants.reduce((s, v) => s + v.stock, 0),
        completeness: completenessOf(p),
        hasDraft: readDraft(p.draft) !== null,
      }
    }),
  }
}

export async function loadProduct(db: Db, code: string) {
  return db.product.findFirst({
    where: { code, deletedAt: null },
    include: {
      brand: true,
      category: true,
      baseProduct: { select: { code: true } },
      variants: { orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      ingredients: { orderBy: { inciOrder: 'asc' }, include: { ingredient: { include: { family: true } } } },
      concerns: { include: { concern: true } },
      skinTypes: { include: { skinType: true } },
      relations: { orderBy: [{ kind: 'asc' }, { position: 'asc' }], include: { related: { select: { code: true, name: true } } } },
      ...completenessInclude,
    },
  })
}

// ------------------------------------------------------- publish checks ----

const S1_KEYS = new Set(SHEETS.Productos.fields.filter((f) => f.req === 'S1').map((f) => f.key))

/**
 * What a product needs before it leaves Borrador: the fields the template
 * requires from the first sample, an image and a main variant.
 */
export async function publishProblems(db: Db | Tx, productId: string): Promise<string[]> {
  const p = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: { select: { isMain: true } }, ...completenessInclude } })
  const merged = withDraft(p)
  const c = productCompleteness({ ...merged, ingredientCount: p._count.ingredients, complementaryCount: p._count.relations })
  const problems = c.missing.filter((m) => S1_KEYS.has(m.key)).map((m) => m.label)
  if (!p.variants.some((v) => v.isMain)) problems.push('Una variante principal')
  return problems
}

const problemsMessage = (problems: string[]) => `Antes de publicarlo falta: ${problems.join(', ')}.`

// ------------------------------------------------------------- create ----

export async function createProduct(db: Db, actor: Actor, input: DataInput & { code?: string; sku?: string } & Record<string, string | string[]>, opts: { canCost: boolean; dermatologistLabelEnabled: boolean }): Promise<Result & { code?: string }> {
  const code = String(input.code ?? '').trim()
  const sku = String(input.sku ?? '').trim()
  const lookups = await productLookups(db, opts.dermatologistLabelEnabled)
  const { values, errors, warnings } = parseData(input, null, lookups)
  const codeError = await newCodeProblem(code, (c) => db.product.findUnique({ where: { code: c }, select: { id: true } }))
  if (codeError) errors.code = codeError
  const variantInput: VariantInput = { size: one(input.size), unit: one(input.unit), priceCents: one(input.priceCents), stock: one(input.stock), isMain: 'on' }
  const variant = parseVariant(variantInput, false)
  for (const [k, v] of Object.entries(variant.errors)) errors[k] ??= v
  const skuError = await skuProblem(db, sku)
  if (skuError) errors.sku = skuError
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)

  const product = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...(toPrismaData(values) as Prisma.ProductUncheckedCreateInput), code, status: 'DRAFT', variants: { create: { ...variant.data, sku, isMain: true } } },
    })
    await audit(tx, actor, { action: 'create', entityType: 'Product', entityId: created.id, label: `${created.name} (${code})`, after: { ...values, firstVariant: { sku, ...variant.data } } })
    return created
  })
  return { ...ok(['Producto creado en Borrador.', ...warnings].join(' ')), code: product.code }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// --------------------------------------------------------------- datos ----

export async function saveProductData(db: Db, actor: Actor, code: string, input: DataInput, opts: { dermatologistLabelEnabled: boolean }): Promise<Result> {
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  const lookups = await productLookups(db, opts.dermatologistLabelEnabled)
  const { values, errors, warnings } = parseData(input, product, lookups)
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)

  const columns = dataOf(product)
  const pending = diffValues(columns, values)
  const label = `${product.name} (${product.code})`

  if (product.status === 'DRAFT') {
    if (!Object.keys(pending).length && !product.draft) return ok('No había cambios.')
    const diff = changedFields(columns, pending)
    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { ...toPrismaData(pending), draft: Prisma.DbNull } })
      await audit(tx, actor, { action: 'update', entityType: 'Product', entityId: product.id, label, before: diff.before, after: diff.after })
    })
    return ok(['Guardado.', ...warnings].join(' '))
  }

  // Published: the changes wait in the draft until "Publicar cambios".
  const previous = readDraft(product.draft)
  const next: DataValues | null = Object.keys(pending).length ? pending : null
  if (JSON.stringify(previous) === JSON.stringify(next)) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { draft: next ?? Prisma.DbNull } })
    await audit(tx, actor, { action: 'draft.update', entityType: 'Product', entityId: product.id, label, before: previous, after: next })
  })
  return ok([next ? 'Guardado como cambios sin publicar: el sitio no cambia hasta que los publiques.' : 'Sin cambios pendientes: el borrador quedó igual a lo publicado.', ...warnings].join(' '))
}

/** "Publicar cambios": the draft goes to the columns and is cleared. */
export async function publishDraft(db: Db, actor: Actor, code: string): Promise<Result> {
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  const draft = readDraft(product.draft)
  if (!draft) return fail('No hay cambios sin publicar.')
  const before = Object.fromEntries(Object.keys(draft).map((k) => [k, dataOf(product)[k] ?? null]))
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { ...toPrismaData(draft), draft: Prisma.DbNull } })
    await audit(tx, actor, { action: 'publish', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before, after: draft })
  })
  return ok('Cambios publicados: ya se ven en el sitio.')
}

export async function discardDraft(db: Db, actor: Actor, code: string): Promise<Result> {
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  const draft = readDraft(product.draft)
  if (!draft) return ok('No había cambios sin publicar.')
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { draft: Prisma.DbNull } })
    await audit(tx, actor, { action: 'draft.discard', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before: draft })
  })
  return ok('Cambios descartados.')
}

// -------------------------------------------------------------- status ----

/**
 * Sets a status inside a transaction. Leaving Borrador needs what
 * publishProblems asks and sets publishedAt the first time (it drives
 * "Novedades" and the automatic "Nuevo"); Preventa needs an arrival date.
 * A pending draft is applied when a product in Borrador is published.
 */
export async function applyStatus(tx: Tx, actor: Actor, product: Product, status: ProductStatus, action = 'status'): Promise<string | null> {
  if (product.status === status) return null
  const leavingDraft = product.status === 'DRAFT'
  if (leavingDraft) {
    const problems = await publishProblems(tx, product.id)
    if (problems.length) return problemsMessage(problems)
  }
  const draft = leavingDraft ? readDraft(product.draft) : null
  const presale = draft && 'presaleDate' in draft ? draft.presaleDate : product.presaleDate
  if (status === 'PRESALE' && !presale) return 'Para Preventa cargá la fecha de llegada en Datos.'
  await tx.product.update({
    where: { id: product.id },
    data: { status, publishedAt: product.publishedAt ?? (status !== 'DRAFT' ? new Date() : null), ...(draft ? { ...toPrismaData(draft), draft: Prisma.DbNull } : {}) },
  })
  await audit(tx, actor, {
    action,
    entityType: 'Product',
    entityId: product.id,
    label: `${product.name} (${product.code})`,
    before: { status: product.status },
    after: { status, ...(draft ?? {}) },
  })
  return null
}

/** "Publicar" on a product in Borrador: Activo, or Preventa when it has an arrival date. */
export async function publishProduct(db: Db, actor: Actor, code: string): Promise<Result> {
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  if (product.status !== 'DRAFT') return fail('El producto ya está publicado.')
  const draft = readDraft(product.draft)
  const status = publishedStatus(draft && 'presaleDate' in draft ? (draft.presaleDate as string | null) : product.presaleDate)
  const problem = await db.$transaction((tx) => applyStatus(tx, actor, product, status, 'publish'))
  if (problem) return fail(problem)
  return ok(`Publicado como ${statusLabel(status)}.`)
}

export async function setProductStatus(db: Db, actor: Actor, code: string, status: string): Promise<Result> {
  if (!LISTS.estado.labels.some(([, v]) => v === status)) return fail('Elegí un estado.', { status: 'Elegí un estado.' })
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  const problem = await db.$transaction((tx) => applyStatus(tx, actor, product, status as ProductStatus))
  if (problem) return fail(problem, { status: problem })
  return ok(`Estado: ${statusLabel(status as ProductStatus)}.`)
}

/** Bulk status from the list: one transaction; products that cannot change are reported and left as they are. */
export async function bulkSetStatus(db: Db, actor: Actor, ids: string[], status: string): Promise<Result> {
  if (!LISTS.estado.labels.some(([, v]) => v === status)) return fail('Elegí un estado.')
  if (!ids.length) return fail('Seleccioná al menos un producto.')
  const products = await db.product.findMany({ where: { id: { in: ids }, deletedAt: null } })
  const skipped: string[] = []
  let changed = 0
  await db.$transaction(
    async (tx) => {
      for (const p of products) {
        if (p.status === status) continue
        const problem = await applyStatus(tx, actor, p, status as ProductStatus, 'bulk.status')
        if (problem) skipped.push(`${p.code}: ${problem}`)
        else changed++
      }
    },
    { timeout: 60_000 },
  )
  const msg = `${changed} ${changed === 1 ? 'producto pasó' : 'productos pasaron'} a ${statusLabel(status as ProductStatus)}.`
  return skipped.length ? { ok: changed > 0, message: `${msg} Sin cambiar: ${skipped.join(' ')}` } : ok(msg)
}

// --------------------------------------------------------------- trash ----

export async function deleteProduct(db: Db, actor: Actor, code: string): Promise<Result> {
  const product = await db.product.findFirst({ where: { code, deletedAt: null } })
  if (!product) return fail('El producto no existe.')
  const routines = await db.routine.findMany({ where: { deletedAt: null, steps: { some: { mainProductId: product.id } } }, select: { name: true } })
  if (routines.length) return fail(`Es el producto principal de un paso en ${routines.map((r) => `"${r.name}"`).join(', ')}: cambialo ahí antes de borrarlo.`)
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})` })
  })
  return ok('Producto enviado a la papelera.')
}
