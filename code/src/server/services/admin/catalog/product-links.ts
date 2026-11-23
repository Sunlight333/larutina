// A product's needs (relevance 0–100), skin types (aptitude) and related
// products. Relational, so they apply at once; the same rules as the
// sheets Prod_Necesidades, Prod_TiposPiel and the relation columns.
import type { Aptitude, ProductRelationKind } from '@prisma/client'
import { audit } from '@/server/audit'
import { LISTS } from '@/server/catalog-import/lists'
import { CODE_RE } from '@/server/catalog-import/rules'
import { fail, ok, type Actor, type Db, type Result } from './common'

export const RELATION_KINDS: { kind: ProductRelationKind; label: string; help: string }[] = [
  { kind: 'COMPLEMENTARY', label: 'Complementarios', help: 'De otros pasos, para completar la rutina ("Completá la rutina").' },
  { kind: 'COMPATIBLE', label: 'Compatibles', help: 'Combinan bien con este producto.' },
  { kind: 'ALTERNATIVE', label: 'Alternativas', help: 'Similares, de otro precio o sensibilidad.' },
]

async function productOf(db: Db, code: string) {
  return db.product.findFirst({ where: { code, deletedAt: null }, select: { id: true, code: true, name: true } })
}

export async function saveProductConcerns(db: Db, actor: Actor, code: string, entries: { concernId: string; relevance: string }[]): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  const errors: Record<string, string> = {}
  const rows: { concernId: string; relevance: number }[] = []
  const live = new Set((await db.concern.findMany({ where: { deletedAt: null }, select: { id: true } })).map((c) => c.id))
  for (const e of entries) {
    const raw = e.relevance.trim()
    if (raw === '') continue
    const n = Number(raw)
    if (!live.has(e.concernId)) errors[`relevance.${e.concernId}`] = 'La necesidad no existe.'
    else if (!Number.isInteger(n) || n < 0 || n > 100) errors[`relevance.${e.concernId}`] = 'Un número entero de 0 a 100.'
    else rows.push({ concernId: e.concernId, relevance: n })
  }
  if (Object.keys(errors).length) return fail('Revisá las relevancias marcadas.', errors)
  const before = (await db.productConcern.findMany({ where: { productId: product.id }, select: { concernId: true, relevance: true } })).sort((a, b) => a.concernId.localeCompare(b.concernId))
  const after = [...rows].sort((a, b) => a.concernId.localeCompare(b.concernId))
  if (JSON.stringify(before) === JSON.stringify(after)) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.productConcern.deleteMany({ where: { productId: product.id } })
    await tx.productConcern.createMany({ data: rows.map((r) => ({ ...r, productId: product.id })) })
    await audit(tx, actor, { action: 'concerns.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before, after })
  })
  return ok(rows.length ? 'Necesidades guardadas.' : 'Necesidades guardadas: sin necesidades, el diagnóstico no lo va a recomendar.')
}

const APTITUDES = LISTS.aptitud.labels.map(([, v]) => v as string)

export async function saveProductSkinTypes(db: Db, actor: Actor, code: string, entries: { skinTypeId: string; aptitude: string }[]): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  const live = new Set((await db.skinType.findMany({ where: { deletedAt: null }, select: { id: true } })).map((s) => s.id))
  const errors: Record<string, string> = {}
  const rows: { skinTypeId: string; aptitude: Aptitude }[] = []
  for (const e of entries) {
    if (!e.aptitude) continue
    if (!live.has(e.skinTypeId)) errors[`aptitude.${e.skinTypeId}`] = 'El tipo de piel no existe.'
    else if (!APTITUDES.includes(e.aptitude)) errors[`aptitude.${e.skinTypeId}`] = 'Elegí una aptitud de la lista.'
    else rows.push({ skinTypeId: e.skinTypeId, aptitude: e.aptitude as Aptitude })
  }
  if (Object.keys(errors).length) return fail('Revisá las aptitudes marcadas.', errors)
  const before = (await db.productSkinType.findMany({ where: { productId: product.id }, select: { skinTypeId: true, aptitude: true } })).sort((a, b) => a.skinTypeId.localeCompare(b.skinTypeId))
  const after = [...rows].sort((a, b) => a.skinTypeId.localeCompare(b.skinTypeId))
  if (JSON.stringify(before) === JSON.stringify(after)) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.productSkinType.deleteMany({ where: { productId: product.id } })
    await tx.productSkinType.createMany({ data: rows.map((r) => ({ ...r, productId: product.id })) })
    await audit(tx, actor, { action: 'skin-types.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before, after })
  })
  return ok('Tipos de piel guardados.')
}

/** Related products by kind, one code per line in order: the position is the line. */
export async function saveProductRelations(db: Db, actor: Actor, code: string, input: Record<ProductRelationKind, string[]>): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  const all = new Map((await db.product.findMany({ where: { deletedAt: null }, select: { id: true, code: true } })).map((p) => [p.code, p.id]))
  const errors: Record<string, string> = {}
  const rows: { relatedId: string; kind: ProductRelationKind; position: number }[] = []
  for (const { kind } of RELATION_KINDS) {
    const codes = [...new Set(input[kind].map((c) => c.trim()).filter(Boolean))]
    const wrong = codes.filter((c) => !CODE_RE.test(c) || !all.has(c))
    if (codes.includes(product.code)) errors[kind] = 'Un producto no puede relacionarse consigo mismo.'
    else if (wrong.length) errors[kind] = `No existen: ${wrong.join(', ')}.`
    else codes.forEach((c, position) => rows.push({ relatedId: all.get(c)!, kind, position }))
  }
  if (Object.keys(errors).length) return fail('Revisá los códigos marcados.', errors)
  const before = (await db.productRelation.findMany({ where: { productId: product.id }, select: { relatedId: true, kind: true, position: true } })).sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position)
  const after = [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position)
  if (JSON.stringify(before) === JSON.stringify(after)) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.productRelation.deleteMany({ where: { productId: product.id } })
    await tx.productRelation.createMany({ data: rows.map((r) => ({ ...r, productId: product.id })) })
    await audit(tx, actor, { action: 'relations.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before, after })
  })
  return ok('Relaciones guardadas.')
}
