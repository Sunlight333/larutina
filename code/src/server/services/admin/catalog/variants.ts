// Variants (Variantes): sizes, prices and stock. Operational data, so every
// change applies at once, also on a published product, and is audited.
// Values go through the importer's column rules: "18.900" is refused with the
// same message, promo stays below price, one main variant per product (CAT-22).
import type { Prisma, ProductVariant, Unit } from '@prisma/client'
import { audit, changedFields } from '@/server/audit'
import { LISTS } from '@/server/catalog-import/lists'
import { parseCell, promoProblem } from '@/server/catalog-import/rules'
import { SHEETS } from '@/server/catalog-import/spec'
import { fail, ok, type Actor, type Db, type Result, type Tx } from './common'

export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const fieldOf = (key: string) => SHEETS.Variantes.fields.find((f) => f.key === key)!

export type VariantInput = Record<string, string | undefined>
export type VariantData = {
  size: number
  unit: Unit
  priceCents: number
  promoPriceCents: number | null
  stock: number
  barcode: string | null
  weightGrams: number | null
  isMain: boolean
  durationDays: number | null
  heightCm: number | null
  widthCm: number | null
  lengthCm: number | null
  costCents?: number | null
}

// Form field → template column, for the checks and messages.
const COLUMNS: [keyof VariantData, string][] = [
  ['size', 'tamano'],
  ['priceCents', 'precio_ars'],
  ['promoPriceCents', 'precio_promocional_ars'],
  ['stock', 'stock'],
  ['barcode', 'codigo_barras'],
  ['weightGrams', 'peso_g'],
  ['durationDays', 'duracion_dias'],
  ['heightCm', 'alto_cm'],
  ['widthCm', 'ancho_cm'],
  ['lengthCm', 'largo_cm'],
  ['costCents', 'costo_ars'],
]

/** Reads a variant form; cost only when the role may see it (CAT-20). */
export function parseVariant(input: VariantInput, canCost: boolean): { data: VariantData; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const data: Record<string, unknown> = { isMain: input.isMain === 'on' || input.isMain === 'true' }
  for (const [name, key] of COLUMNS) {
    if (name === 'costCents' && !canCost) continue
    const field = fieldOf(key)
    const raw = (input[name] ?? '').trim().replace(/^\$\s*/, '')
    if (raw === '') {
      if (field.req === 'S1') errors[name] = 'Campo obligatorio.'
      data[name] = null
      continue
    }
    const parsed = parseCell(field, raw)
    if (!parsed.ok) {
      errors[name] = parsed.message
      continue
    }
    const n = parsed.value as number | string
    data[name] = field.type === 'money' ? Math.round((n as number) * 100) : n
  }
  const unit = input.unit ?? ''
  if (!LISTS.unidad.labels.some(([, v]) => v === unit)) errors.unit = 'Elegí una unidad.'
  else data.unit = unit
  const promo = promoProblem(data.priceCents as number | null, data.promoPriceCents as number | null, (c) => String(c / 100))
  if (promo && !errors.promoPriceCents) errors.promoPriceCents = promo
  return { data: data as VariantData, errors }
}

const auditable = (v: ProductVariant | VariantData, canCost: boolean) => {
  const { size, unit, priceCents, promoPriceCents, stock, barcode, weightGrams, isMain, durationDays, heightCm, widthCm, lengthCm, costCents } = v
  const out: Record<string, unknown> = { size: Number(size), unit, priceCents, promoPriceCents, stock, barcode, weightGrams, isMain, durationDays }
  out.heightCm = heightCm === null ? null : Number(heightCm)
  out.widthCm = widthCm === null ? null : Number(widthCm)
  out.lengthCm = lengthCm === null ? null : Number(lengthCm)
  if (canCost && costCents !== undefined) out.costCents = costCents
  return out
}

/** One main variant per product: making one main unmarks the others. */
async function keepOneMain(tx: Tx, productId: string, mainSku: string) {
  await tx.productVariant.updateMany({ where: { productId, sku: { not: mainSku }, isMain: true }, data: { isMain: false } })
}

export async function createVariant(db: Db, actor: Actor, productCode: string, sku: string, input: VariantInput, canCost: boolean): Promise<Result> {
  const product = await db.product.findFirst({ where: { code: productCode, deletedAt: null }, include: { variants: { select: { id: true } } } })
  if (!product) return fail('El producto no existe.')
  const { data, errors } = parseVariant(input, canCost)
  const skuError = await skuProblem(db, sku)
  if (skuError) errors.sku = skuError
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  // The first variant is the main one whatever the form says.
  if (!product.variants.length) data.isMain = true
  await db.$transaction(async (tx) => {
    const v = await tx.productVariant.create({ data: { ...data, sku, productId: product.id } as Prisma.ProductVariantUncheckedCreateInput })
    if (data.isMain) await keepOneMain(tx, product.id, sku)
    await audit(tx, actor, { action: 'create', entityType: 'ProductVariant', entityId: v.id, label: `${sku} (${product.code})`, after: auditable(data, canCost) })
  })
  return ok('Variante agregada.')
}

export async function skuProblem(db: Db | Tx, sku: string): Promise<string | null> {
  if (!sku) return 'Escribí el SKU.'
  if (!SKU_RE.test(sku)) return 'Solo letras, números, puntos, guiones y guiones bajos, sin espacios.'
  if (await db.productVariant.findUnique({ where: { sku }, select: { id: true } })) return 'Ese SKU ya existe.'
  return null
}

/** The SKU itself never changes: it is the key of orders, kits and the template. */
export async function updateVariant(db: Db, actor: Actor, sku: string, input: VariantInput, canCost: boolean): Promise<Result> {
  const before = await db.productVariant.findUnique({ where: { sku }, include: { product: { select: { code: true } } } })
  if (!before) return fail('La variante no existe.')
  const { data, errors } = parseVariant(input, canCost)
  if (before.isMain && !data.isMain) errors.isMain = 'Tiene que haber una variante principal: marcá otra como principal.'
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  const diff = changedFields(auditable(before, canCost), auditable(data, canCost))
  if (!diff.changed) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.productVariant.update({ where: { sku }, data })
    if (data.isMain) await keepOneMain(tx, before.productId, sku)
    await audit(tx, actor, { action: 'update', entityType: 'ProductVariant', entityId: before.id, label: `${sku} (${before.product.code})`, before: diff.before, after: diff.after })
  })
  return ok('Variante guardada.')
}

export async function deleteVariant(db: Db, actor: Actor, sku: string, canCost: boolean): Promise<Result> {
  const v = await db.productVariant.findUnique({ where: { sku }, include: { product: { select: { id: true, code: true, _count: { select: { variants: true } } } } } })
  if (!v) return fail('La variante no existe.')
  if (v.product._count.variants <= 1) return fail('Es la única variante del producto: un producto necesita al menos una.')
  if (v.isMain) return fail('Es la variante principal: marcá otra como principal antes de borrarla.')
  const kits = await db.product.findMany({ where: { kitContents: { has: sku }, deletedAt: null }, select: { code: true } })
  if (kits.length) return fail(`El SKU está en el contenido de ${kits.map((k) => k.code).join(', ')}: sacalo de ahí antes de borrarlo.`)
  await db.$transaction(async (tx) => {
    await tx.productVariant.delete({ where: { sku } })
    await audit(tx, actor, { action: 'delete', entityType: 'ProductVariant', entityId: v.id, label: `${sku} (${v.product.code})`, before: auditable(v, canCost) })
  })
  return ok('Variante borrada.')
}
