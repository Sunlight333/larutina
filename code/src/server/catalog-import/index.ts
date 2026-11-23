// Catalog import (CAT-02): read the workbook, validate everything against the
// v1.1 contract and the current database, and write only when there are no
// errors. Every run, applied or not, is stored as an ImportJob with its report.
import type { Prisma, PrismaClient } from '@prisma/client'
import { applyCatalog, type Counts } from './apply'
import { validateCatalog, type Existing, type Issue, type Stage } from './validate'
import { readWorkbook } from './workbook'

export type ImportReport = {
  jobId: string
  status: 'REJECTED' | 'VALIDATED' | 'APPLIED'
  stage: Stage
  errors: number
  warnings: number
  issues: Issue[]
  missing: { sheet: string; field: string; rows: number }[]
  /** Records per sheet: what the file holds, and on APPLIED what was created or updated. */
  counts: Counts
}

export async function loadExisting(db: PrismaClient): Promise<Existing> {
  const [brands, categories, concerns, skinTypes, families, ingredients, products, variants, routines, criteria] = await Promise.all([
    db.brand.findMany({ select: { code: true } }),
    db.category.findMany({ select: { code: true } }),
    db.concern.findMany({ select: { code: true } }),
    db.skinType.findMany({ select: { code: true } }),
    db.ingredientFamily.findMany({ select: { code: true, computes: true } }),
    db.ingredient.findMany({ select: { code: true, inciKey: true, family: { select: { code: true } } } }),
    db.product.findMany({ select: { code: true } }),
    db.productVariant.findMany({ select: { sku: true, priceCents: true, product: { select: { code: true } } } }),
    db.routine.findMany({ select: { code: true } }),
    db.evaluationCriterion.findMany({ select: { code: true } }),
  ])
  const codes = (rows: { code: string }[]) => new Set(rows.map((r) => r.code))
  return {
    brands: codes(brands),
    categories: codes(categories),
    concerns: codes(concerns),
    skinTypes: codes(skinTypes),
    families: new Map(families.map((f) => [f.code, { computes: f.computes }])),
    ingredients: new Map(ingredients.map((i) => [i.code, { inciKey: i.inciKey, familyCode: i.family?.code ?? null }])),
    products: codes(products),
    variants: new Map(variants.map((v) => [v.sku, { priceCents: v.priceCents, productCode: v.product.code }])),
    routines: codes(routines),
    criteria: codes(criteria),
  }
}

export async function importCatalog(
  db: PrismaClient,
  file: { name: string; data: ArrayBuffer | Uint8Array },
  options: { stage?: Stage; dryRun?: boolean } = {},
): Promise<ImportReport> {
  const stage = options.stage ?? 'S1'
  const wb = await readWorkbook(file.data)
  const { input, issues, missing } = validateCatalog(wb, await loadExisting(db), stage)
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.filter((i) => i.level === 'warning').length

  const fileCounts: Counts = Object.fromEntries(
    (
      [
        ['Marcas', input.brands],
        ['Categorias', input.categories],
        ['Necesidades', input.concerns],
        ['TiposDePiel', input.skinTypes],
        ['Familias', input.families],
        ['Ingredientes', input.ingredients],
        ['Conflictos', input.conflicts],
        ['Conflictos_Familias', input.familyConflicts],
        ['Productos', input.products],
        ['Variantes', input.variants],
        ['Rutinas', input.routines],
        ['Criterios', input.criteria],
        ['Evaluacion', input.evaluations],
        ['Avales', input.endorsements],
        ['Base_Conocimiento', input.knowledge],
        ['Sinonimos', input.synonyms],
      ] as const
    )
      .filter(([, list]) => list.length)
      .map(([sheet, list]) => [sheet, { created: 0, updated: 0, inFile: list.length }]),
  )

  let status: ImportReport['status'] = errors ? 'REJECTED' : options.dryRun ? 'VALIDATED' : 'APPLIED'
  let counts: Counts = fileCounts
  if (status === 'APPLIED') counts = await applyCatalog(db, input)

  const job = await db.importJob.create({
    data: {
      fileName: file.name,
      status,
      stage,
      summary: { counts, missing } as unknown as Prisma.InputJsonValue,
      issues: issues as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  })
  return { jobId: job.id, status, stage, errors, warnings, issues, missing, counts }
}
