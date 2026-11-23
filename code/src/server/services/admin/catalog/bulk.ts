// Bulk updates (CAT-04): price, promotional price, stock and status, from a
// simple sheet or from a filtered set in the panel. Always in two steps: a
// preview with every change old → new and every problem per row, then one
// transaction that applies them all and audits each one. Nothing is applied
// while the preview has errors, the same all-or-nothing rule as the import.
import type { Prisma, ProductStatus } from '@prisma/client'
import { audit } from '@/server/audit'
import { fold, LISTS, labelOf, lookup } from '@/server/catalog-import/lists'
import { parseCell, promoProblem } from '@/server/catalog-import/rules'
import { SHEETS } from '@/server/catalog-import/spec'
import { readWorkbook } from '@/server/catalog-import/workbook'
import { fail, formatPesos, ok, type Actor, type Db, type Result } from './common'
import { applyStatus, productWhere, publishProblems, type ProductFilters } from './products'

export const BULK_COLUMNS = ['sku', 'precio_ars', 'precio_promocional_ars', 'stock', 'estado'] as const
export const MAX_BULK_BYTES = 10 * 1024 * 1024

type Pair<T> = { from: T; to: T }
export type VariantChange = {
  kind: 'variant'
  row?: number
  sku: string
  productCode: string
  productName: string
  price?: Pair<number>
  promo?: Pair<number | null>
  stock?: Pair<number>
}
export type StatusChange = { kind: 'status'; row?: number; productCode: string; productName: string; status: Pair<ProductStatus> }
export type Change = VariantChange | StatusChange
export type RowError = { row?: number; ref: string; message: string }
export type Preview = { changes: Change[]; errors: RowError[]; unchanged: number; rows: number }

// ------------------------------------------------------------ reading ----

/** Splits CSV text with quotes; the separator is whichever of , ; or tab the header uses most (Excel in Spanish writes ";"). */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '')
  const header = body.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', ',', '\t'].sort((a, b) => header.split(b).length - header.split(a).length)[0]!
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export type SheetRows = { row: number; cells: Record<string, string> }[]

/** The rows of a bulk sheet: an .xlsx (the first sheet with a "sku" column) or a .csv. */
export async function readBulkFile(name: string, data: Uint8Array): Promise<{ rows: SheetRows } | { error: string }> {
  if (data.byteLength > MAX_BULK_BYTES) return { error: 'El archivo pesa más de 10 MB.' }
  const norm = (h: string) => fold(h).replace(/\s+/g, '_')
  if (/\.csv$/i.test(name)) {
    const [head, ...body] = parseCsv(new TextDecoder('utf-8').decode(data))
    if (!head) return { error: 'El archivo está vacío.' }
    const headers = head.map(norm)
    if (!headers.includes('sku')) return { error: 'Falta la columna "sku" en la primera fila.' }
    return { rows: body.map((r, i) => ({ row: i + 2, cells: Object.fromEntries(headers.map((h, j) => [h, (r[j] ?? '').trim()])) })) }
  }
  if (!/\.xlsx$/i.test(name)) return { error: 'Usá un archivo .xlsx o .csv.' }
  let wb
  try {
    wb = await readWorkbook(data)
  } catch {
    return { error: 'No se pudo leer el archivo como .xlsx.' }
  }
  const sheet = [...wb.values()].find((s) => s.headers.some((h) => norm(h) === 'sku'))
  if (!sheet) return { error: 'Ninguna hoja tiene la columna "sku" en la primera fila.' }
  return { rows: sheet.rows.map((r) => ({ row: r.row, cells: Object.fromEntries(Object.entries(r.cells).map(([h, v]) => [norm(h), v])) })) }
}

// ------------------------------------------------------------ preview ----

const fieldOf = (key: string) => SHEETS.Variantes.fields.find((f) => f.key === key)!
const variantSelect = { sku: true, priceCents: true, promoPriceCents: true, stock: true, product: { select: { id: true, code: true, name: true, status: true, deletedAt: true } } } satisfies Prisma.ProductVariantSelect

/** "0" in precio_promocional_ars removes the promotion; an empty cell leaves every value as it is. */
export async function previewSheet(db: Db, rows: SheetRows): Promise<Preview> {
  const errors: RowError[] = []
  const changes: Change[] = []
  let unchanged = 0
  const skus = [...new Set(rows.map((r) => r.cells.sku ?? '').filter(Boolean))]
  const variants = new Map((await db.productVariant.findMany({ where: { sku: { in: skus } }, select: variantSelect })).map((v) => [v.sku, v]))
  const seen = new Map<string, number>()
  const statusByProduct = new Map<string, { row: number; status: ProductStatus }>()

  for (const r of rows) {
    const sku = (r.cells.sku ?? '').trim()
    const err = (message: string) => errors.push({ row: r.row, ref: sku || '—', message })
    if (!sku) {
      err('Falta el SKU.')
      continue
    }
    if (seen.has(sku)) {
      err(`SKU repetido: ya está en la fila ${seen.get(sku)}.`)
      continue
    }
    seen.set(sku, r.row)
    const v = variants.get(sku)
    if (!v || v.product.deletedAt) {
      err('El SKU no existe.')
      continue
    }
    const read = (key: string): number | null | undefined | 'error' => {
      const raw = (r.cells[key] ?? '').trim()
      if (raw === '') return undefined
      const parsed = parseCell(fieldOf(key), raw)
      if (!parsed.ok) {
        errors.push({ row: r.row, ref: sku, message: `${key}: ${parsed.message}` })
        return 'error'
      }
      return parsed.value as number
    }
    const price = read('precio_ars')
    const promoRaw = read('precio_promocional_ars')
    const stock = read('stock')
    if (price === 'error' || promoRaw === 'error' || stock === 'error') continue
    const toPrice = price === undefined || price === null ? v.priceCents : Math.round(price * 100)
    const toPromo = promoRaw === undefined || promoRaw === null ? v.promoPriceCents : promoRaw === 0 ? null : Math.round(promoRaw * 100)
    if (toPrice <= 0) {
      err('precio_ars: el precio tiene que ser mayor que 0.')
      continue
    }
    const promoError = promoProblem(toPrice, toPromo, (c) => String(c / 100))
    if (promoError) {
      err(`precio_promocional_ars: ${promoError}`)
      continue
    }
    const change: VariantChange = { kind: 'variant', row: r.row, sku, productCode: v.product.code, productName: v.product.name }
    if (toPrice !== v.priceCents) change.price = { from: v.priceCents, to: toPrice }
    if (toPromo !== v.promoPriceCents) change.promo = { from: v.promoPriceCents, to: toPromo }
    if (stock !== undefined && stock !== null && stock !== v.stock) change.stock = { from: v.stock, to: stock }

    const statusRaw = (r.cells.estado ?? '').trim()
    let statusChange: StatusChange | null = null
    if (statusRaw) {
      const status = lookup(LISTS.estado, statusRaw)
      if (!status) {
        err(`estado: "${statusRaw}" no está en la lista. Valores posibles: ${LISTS.estado.labels.map(([l]) => l).join(', ')}.`)
        continue
      }
      // The status belongs to the product: two SKUs of one product must agree.
      const other = statusByProduct.get(v.product.code)
      if (other && other.status !== status) {
        err(`estado: la fila ${other.row} pone a "${v.product.code}" en ${labelOf(LISTS.estado, other.status)}; un producto tiene un solo estado.`)
        continue
      }
      if (!other) {
        statusByProduct.set(v.product.code, { row: r.row, status })
        if (status !== v.product.status) {
          if (v.product.status === 'DRAFT') {
            const problems = await publishProblems(db, v.product.id)
            if (problems.length) {
              err(`estado: antes de publicar "${v.product.code}" falta: ${problems.join(', ')}.`)
              continue
            }
          }
          statusChange = { kind: 'status', row: r.row, productCode: v.product.code, productName: v.product.name, status: { from: v.product.status, to: status } }
        }
      }
    }
    if (change.price || change.promo || change.stock) changes.push(change)
    if (statusChange) changes.push(statusChange)
    if (!change.price && !change.promo && !change.stock && !statusChange) unchanged++
  }
  return { changes, errors, unchanged, rows: rows.length }
}

/** Panel mode: a percentage on price (and promo, when there is one), rounded to whole pesos. */
export async function previewPercent(db: Db, filters: ProductFilters, percent: number): Promise<Preview> {
  const errors: RowError[] = []
  const changes: Change[] = []
  let unchanged = 0
  if (!Number.isFinite(percent) || percent <= -100 || percent > 1000 || percent === 0) return { changes, errors: [{ ref: '—', message: 'Escribí un porcentaje distinto de 0, mayor que -100.' }], unchanged, rows: 0 }
  const variants = await db.productVariant.findMany({ where: { product: productWhere(filters) }, select: variantSelect, orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }] })
  const round = (cents: number) => Math.round((cents * (1 + percent / 100)) / 100) * 100
  for (const v of variants) {
    const to = round(v.priceCents)
    const promo = v.promoPriceCents === null ? null : round(v.promoPriceCents)
    if (to <= 0) {
      errors.push({ ref: v.sku, message: 'El precio quedaría en 0.' })
      continue
    }
    const promoError = promoProblem(to, promo, (c) => String(c / 100))
    if (promoError) {
      errors.push({ ref: v.sku, message: promoError })
      continue
    }
    const change: VariantChange = { kind: 'variant', sku: v.sku, productCode: v.product.code, productName: v.product.name }
    if (to !== v.priceCents) change.price = { from: v.priceCents, to }
    if (promo !== v.promoPriceCents) change.promo = { from: v.promoPriceCents, to: promo }
    if (change.price || change.promo) changes.push(change)
    else unchanged++
  }
  return { changes, errors, unchanged, rows: variants.length }
}

/** Panel mode: one status for every product of the filter. */
export async function previewStatus(db: Db, filters: ProductFilters, status: string): Promise<Preview> {
  if (!LISTS.estado.labels.some(([, v]) => v === status)) return { changes: [], errors: [{ ref: '—', message: 'Elegí un estado.' }], unchanged: 0, rows: 0 }
  const products = await db.product.findMany({ where: productWhere(filters), select: { id: true, code: true, name: true, status: true }, orderBy: { name: 'asc' } })
  const changes: Change[] = []
  const errors: RowError[] = []
  let unchanged = 0
  for (const p of products) {
    if (p.status === status) {
      unchanged++
      continue
    }
    if (p.status === 'DRAFT') {
      const problems = await publishProblems(db, p.id)
      if (problems.length) {
        errors.push({ ref: p.code, message: `Antes de publicarlo falta: ${problems.join(', ')}.` })
        continue
      }
    }
    changes.push({ kind: 'status', productCode: p.code, productName: p.name, status: { from: p.status, to: status as ProductStatus } })
  }
  return { changes, errors, unchanged, rows: products.length }
}

// -------------------------------------------------------------- apply ----

/** A change as it reads in the preview table. */
export function describeChange(c: Change): { ref: string; what: string; from: string; to: string }[] {
  if (c.kind === 'status') return [{ ref: c.productCode, what: 'Estado', from: labelOf(LISTS.estado, c.status.from), to: labelOf(LISTS.estado, c.status.to) }]
  const out: { ref: string; what: string; from: string; to: string }[] = []
  if (c.price) out.push({ ref: c.sku, what: 'Precio', from: formatPesos(c.price.from), to: formatPesos(c.price.to) })
  if (c.promo) out.push({ ref: c.sku, what: 'Precio promocional', from: formatPesos(c.promo.from), to: c.promo.to === null ? 'Sin promoción' : formatPesos(c.promo.to) })
  if (c.stock) out.push({ ref: c.sku, what: 'Stock', from: String(c.stock.from), to: String(c.stock.to) })
  return out
}

/**
 * Applies a previewed set in one transaction. Each change is checked again
 * against the database: if a value moved since the preview, nothing is
 * applied and the preview has to be made again.
 */
export async function applyChanges(db: Db, actor: Actor, changes: Change[]): Promise<Result> {
  if (!changes.length) return fail('No hay cambios para aplicar.')
  if (changes.length > 5000) return fail('Son demasiados cambios para una sola vez: dividí la planilla.')
  const stale: string[] = []
  const problems: string[] = []
  try {
    await db.$transaction(
      async (tx) => {
        for (const c of changes) {
          if (c.kind === 'variant') {
            const v = await tx.productVariant.findUnique({ where: { sku: c.sku }, include: { product: { select: { code: true, deletedAt: true } } } })
            if (!v || v.product.deletedAt) {
              stale.push(c.sku)
              continue
            }
            if ((c.price && c.price.from !== v.priceCents) || (c.promo && c.promo.from !== v.promoPriceCents) || (c.stock && c.stock.from !== v.stock)) {
              stale.push(c.sku)
              continue
            }
            const price = c.price?.to ?? v.priceCents
            const promo = c.promo ? c.promo.to : v.promoPriceCents
            const stock = c.stock?.to ?? v.stock
            const promoError = promoProblem(price, promo, (x) => String(x / 100))
            if (price <= 0 || !Number.isInteger(price) || (promo !== null && !Number.isInteger(promo)) || !Number.isInteger(stock) || stock < 0 || promoError) {
              problems.push(`${c.sku}: ${promoError ?? 'valores no válidos.'}`)
              continue
            }
            const data = { priceCents: price, promoPriceCents: promo, stock }
            await tx.productVariant.update({ where: { sku: c.sku }, data })
            const before: Record<string, unknown> = {}
            const after: Record<string, unknown> = {}
            if (c.price) [before.priceCents, after.priceCents] = [c.price.from, c.price.to]
            if (c.promo) [before.promoPriceCents, after.promoPriceCents] = [c.promo.from, c.promo.to]
            if (c.stock) [before.stock, after.stock] = [c.stock.from, c.stock.to]
            await audit(tx, actor, { action: 'bulk.update', entityType: 'ProductVariant', entityId: v.id, label: `${c.sku} (${v.product.code})`, before, after })
          } else {
            const p = await tx.product.findFirst({ where: { code: c.productCode, deletedAt: null } })
            if (!p || p.status !== c.status.from) {
              stale.push(c.productCode)
              continue
            }
            const problem = await applyStatus(tx, actor, p, c.status.to, 'bulk.status')
            if (problem) problems.push(`${c.productCode}: ${problem}`)
          }
        }
        if (stale.length || problems.length) throw new Rollback()
      },
      { timeout: 120_000 },
    )
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
    if (stale.length) return fail(`Algunos valores cambiaron desde la vista previa (${stale.slice(0, 10).join(', ')}${stale.length > 10 ? '…' : ''}). No se aplicó nada: generá la vista previa de nuevo.`)
    return fail(`No se aplicó nada: ${problems.slice(0, 10).join(' ')}`)
  }
  const n = changes.reduce((s, c) => s + describeChange(c).length, 0)
  return ok(`Listo: ${n} ${n === 1 ? 'cambio aplicado' : 'cambios aplicados'}.`)
}

class Rollback extends Error {}

/** The preview travels to the apply step as JSON in the form; it is only trusted after applyChanges checks it again. */
export function parseChanges(json: string): Change[] | null {
  try {
    const data = JSON.parse(json) as unknown
    if (!Array.isArray(data)) return null
    const intOrNull = (x: unknown) => x === null || Number.isInteger(x)
    const pair = (p: unknown, check: (x: unknown) => boolean) => p === undefined || (typeof p === 'object' && p !== null && check((p as Pair<unknown>).from) && check((p as Pair<unknown>).to))
    const statuses = LISTS.estado.labels.map(([, v]) => v as unknown)
    for (const c of data as Change[]) {
      if (c?.kind === 'variant') {
        if (typeof c.sku !== 'string' || !pair(c.price, Number.isInteger) || !pair(c.promo, intOrNull) || !pair(c.stock, Number.isInteger)) return null
      } else if (c?.kind === 'status') {
        if (typeof c.productCode !== 'string' || !pair(c.status, (x) => statuses.includes(x))) return null
      } else return null
    }
    return data as Change[]
  } catch {
    return null
  }
}

/** The bulk sheet to fill in: every live variant with its current values. */
export async function bulkTemplateRows(db: Db) {
  const variants = await db.productVariant.findMany({
    where: { product: { deletedAt: null } },
    orderBy: [{ product: { createdAt: 'asc' } }, { product: { id: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { sku: true, priceCents: true, promoPriceCents: true, stock: true, product: { select: { code: true, name: true, status: true } } },
  })
  return variants.map((v) => ({
    sku: v.sku,
    codigo_producto: v.product.code,
    producto: v.product.name,
    precio_ars: v.priceCents / 100,
    precio_promocional_ars: v.promoPriceCents === null ? null : v.promoPriceCents / 100,
    stock: v.stock,
    estado: labelOf(LISTS.estado, v.product.status),
  }))
}
