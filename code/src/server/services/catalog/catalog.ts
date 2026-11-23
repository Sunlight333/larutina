// The published catalog as plain objects, read once per request. The catalog
// is hundreds of products, so listing filters, facet counts and sorts run in
// memory over this snapshot (one query) rather than as one query per facet.
import { cache } from 'react'
import type { Aptitude, Moment, Prisma, PrismaClient, ProductLabel, ProductStatus, ProductType, RoutineStepType, SealValue, Unit } from '@prisma/client'
import { getDb } from '@/server/db'
import { getSettings, loadSettings, type SettingValues } from '@/server/settings'
import { cardLabels, chargedCents, orInherit, presaleLabel, publishedProductWhere, sizeLabel, stockState, variantAvailable, type StockState } from './rules'
import { STEP_LABELS } from './labels'

export type CatalogVariant = {
  sku: string
  size: number
  unit: Unit
  sizeLabel: string
  priceCents: number
  promoPriceCents: number | null
  chargedCents: number
  stock: number
  available: boolean
  isMain: boolean
  durationDays: number | null
}

export type CatalogItem = {
  id: string
  code: string
  name: string
  type: ProductType
  status: ProductStatus
  brand: { id: string; code: string; name: string }
  categoryId: string
  /** The category and its ancestors, nearest first (a "Limpieza" filter includes "Limpiadores"). */
  categoryPath: string[]
  line: string | null
  moment: Moment
  routineStep: RoutineStepType
  stepLabel: string
  /** Computed from the INCI; only claimed when the product has an ingredient list. */
  fragranceFree: boolean
  seals: { vegan: SealValue; crueltyFree: SealValue; dermatologistTested: SealValue }
  skinTypes: { code: string; aptitude: Aptitude }[]
  concerns: { code: string; relevance: number }[]
  priority: number | null
  manualOrder: number | null
  publishedAt: Date | null
  labels: string[]
  presale: string | null
  stock: StockState
  image: string | null
  variants: CatalogVariant[]
  main: CatalogVariant
}

const taxonomyInclude = {
  concerns: { select: { relevance: true, concern: { select: { code: true, deletedAt: true } } } },
  skinTypes: { select: { aptitude: true, skinType: { select: { code: true, deletedAt: true } } } },
  _count: { select: { ingredients: true } },
} satisfies Prisma.ProductInclude

export const catalogInclude = {
  ...taxonomyInclude,
  brand: { select: { id: true, code: true, name: true } },
  variants: true,
  baseProduct: { include: taxonomyInclude },
} satisfies Prisma.ProductInclude

export type CatalogRow = Prisma.ProductGetPayload<{ include: typeof catalogInclude }>

export type CategoryNode = { id: string; code: string; name: string; parentId: string | null; sortOrder: number | null; description: string | null }

export function categoryPaths(categories: CategoryNode[]): Map<string, string[]> {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out = new Map<string, string[]>()
  for (const c of categories) {
    const path: string[] = []
    let at: CategoryNode | undefined = c
    // The depth guard protects against a cycle typed in the panel.
    while (at && path.length < 10) {
      path.push(at.code)
      at = at.parentId ? byId.get(at.parentId) : undefined
    }
    out.set(c.id, path)
  }
  return out
}

export function toCatalogVariants(status: ProductStatus, variants: CatalogRow['variants']): CatalogVariant[] {
  return variants
    .map((v) => {
      const size = Number(v.size)
      return {
        sku: v.sku,
        size,
        unit: v.unit,
        sizeLabel: sizeLabel(size, v.unit),
        priceCents: v.priceCents,
        promoPriceCents: v.promoPriceCents,
        chargedCents: chargedCents(v),
        stock: v.stock,
        available: variantAvailable(status, v.stock),
        isMain: v.isMain,
        durationDays: v.durationDays,
      }
    })
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.size - b.size)
}

type Context = { paths: Map<string, string[]>; newDays: number; dermatologistEnabled: boolean; now: Date }

/** One product row → the listing/search shape, with travel sizes inheriting their base (CAT-07). */
export function toCatalogItem(p: CatalogRow, ctx: Context): CatalogItem | null {
  const variants = toCatalogVariants(p.status, p.variants)
  const main = variants.find((v) => v.isMain) ?? variants[0]
  if (!main) return null // a product without sizes cannot be shown or sold
  const base = p.type === 'TRAVEL_SIZE' ? p.baseProduct : null
  const own = { concerns: p.concerns, skinTypes: p.skinTypes }
  const concerns = orInherit(own.concerns, base?.concerns)
  const skinTypes = orInherit(own.skinTypes, base?.skinTypes)
  // Flags are computed from the ingredient list: a mini without its own list takes its base's.
  const flagsFrom = p._count.ingredients === 0 && base ? base : p
  const hasInci = flagsFrom._count.ingredients > 0
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    type: p.type,
    status: p.status,
    brand: p.brand,
    categoryId: p.categoryId,
    categoryPath: ctx.paths.get(p.categoryId) ?? [],
    line: p.line?.trim() || null,
    moment: p.moment,
    routineStep: p.routineStep,
    stepLabel: STEP_LABELS[p.routineStep],
    fragranceFree: hasInci && flagsFrom.fragranceFree,
    seals: { vegan: p.vegan, crueltyFree: p.crueltyFree, dermatologistTested: p.dermatologistTested },
    skinTypes: skinTypes.filter((s) => !s.skinType.deletedAt).map((s) => ({ code: s.skinType.code, aptitude: s.aptitude })),
    concerns: concerns.filter((c) => !c.concern.deletedAt).map((c) => ({ code: c.concern.code, relevance: c.relevance })),
    priority: p.priority,
    manualOrder: p.manualOrder,
    publishedAt: p.publishedAt,
    labels: cardLabels({ labels: p.labels as ProductLabel[], publishedAt: p.publishedAt }, ctx, ctx.now),
    presale: p.status === 'PRESALE' ? presaleLabel(p.presaleDate, ctx.now) : null,
    stock: stockState(p.status, p.variants),
    image: p.images[0] ?? null,
    variants,
    main,
  }
}

export async function loadCategories(db: PrismaClient): Promise<CategoryNode[]> {
  return db.category.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, parentId: true, sortOrder: true, description: true },
    orderBy: [{ sortOrder: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
  })
}

export async function loadCatalog(db: PrismaClient, settings?: SettingValues, where: Prisma.ProductWhereInput = publishedProductWhere()): Promise<CatalogItem[]> {
  const [rows, categories, s] = await Promise.all([db.product.findMany({ where, include: catalogInclude }), loadCategories(db), settings ?? loadSettings(db)])
  const ctx: Context = {
    paths: categoryPaths(categories),
    newDays: s['catalog.newDays'],
    dermatologistEnabled: s['catalog.dermatologistLabelEnabled'],
    now: new Date(),
  }
  return rows.map((r) => toCatalogItem(r, ctx)).filter((x): x is CatalogItem => !!x)
}

/** The published catalog for this request. */
export const getCatalog = cache(async () => loadCatalog(getDb(), await getSettings()))

export const getCategories = cache(async () => loadCategories(getDb()))
