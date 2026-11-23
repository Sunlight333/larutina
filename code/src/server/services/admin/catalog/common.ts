// Shared pieces of the catalog services: who acts, code checks and the
// lookups the product form needs.
import type { Prisma, PrismaClient } from '@prisma/client'
import { CODE_RE, codeMessage } from '@/server/catalog-import/rules'
import { fail as baseFail, ok as baseOk, type FormState } from '@/server/admin/forms'
import type { Lookups } from './product-fields'

export type Actor = { id: string; email: string }
export type Db = PrismaClient
export type Tx = Prisma.TransactionClient

/**
 * CAT-01: a code is set once, in kebab-case, and never reused, so it is
 * checked against every record, also those in the trash.
 */
export async function newCodeProblem(code: string, exists: (code: string) => Promise<unknown>): Promise<string | null> {
  if (!code) return 'Escribí el código.'
  if (!CODE_RE.test(code)) return codeMessage(code)
  if (code.length > 80) return 'El código es demasiado largo (máximo 80 caracteres).'
  if (await exists(code)) return 'Ese código ya existe (o existió): los códigos no se reutilizan.'
  return null
}

export async function productLookups(db: Db, dermatologistLabelEnabled: boolean): Promise<Lookups> {
  const [brands, categories, products, variants] = await Promise.all([
    db.brand.findMany({ where: { deletedAt: null }, select: { id: true, code: true } }),
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, code: true } }),
    db.product.findMany({ where: { deletedAt: null }, select: { id: true, code: true, type: true } }),
    db.productVariant.findMany({ select: { sku: true } }),
  ])
  return {
    brands: new Map(brands.map((b) => [b.id, b.code])),
    categories: new Map(categories.map((c) => [c.id, c.code])),
    productIdByCode: new Map(products.map((p) => [p.code, { id: p.id, type: p.type }])),
    skus: new Set(variants.map((v) => v.sku)),
    dermatologistLabelEnabled,
  }
}

/** Whole pesos and centavos as the panel writes them: 18900 or 18900,50. */
export const formatPesos = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100)}`

/** What a service returns to an action: FormState without the initial null. */
export type Result = NonNullable<FormState>
export const ok = (message?: string): Result => baseOk(message) as Result
export const fail = (message: string, fieldErrors?: Record<string, string>): Result => baseFail(message, fieldErrors) as Result
