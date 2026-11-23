import type { PrismaClient, ProductStatus } from '@prisma/client'
import { resolveImages, type ResolvedImage } from '@/server/media'

// What content blocks and articles show of the catalog. Read straight from
// the published catalog, so an archived or unpublished product or routine
// disappears from every block on its own (H-12).

export const LIVE_STATUSES: ProductStatus[] = ['ACTIVE', 'PRESALE', 'SOLD_OUT']
const live = { status: { in: LIVE_STATUSES }, deletedAt: null }

export type ProductTeaser = {
  code: string
  name: string
  brand: string
  href: string
  image: ResolvedImage | null
  priceCents: number | null
  compareAtCents: number | null // the list price when a promo price applies
  status: ProductStatus
  headline: string | null
}

/** Published products by code, in the order given; unknown or unpublished codes are skipped. */
export async function getProductTeasers(db: PrismaClient, codes: string[]): Promise<ProductTeaser[]> {
  if (!codes.length) return []
  const rows = await db.product.findMany({
    where: { ...live, code: { in: codes } },
    select: { code: true, name: true, status: true, headline: true, images: true, brand: { select: { name: true } }, variants: { where: { isMain: true }, select: { priceCents: true, promoPriceCents: true }, take: 1 } },
  })
  const images = await resolveImages(db, rows.map((r) => r.images[0] ?? ''))
  const byCode = new Map(rows.map((r) => [r.code, r]))
  return codes.flatMap((code) => {
    const r = byCode.get(code)
    if (!r) return []
    const v = r.variants[0]
    const promo = v?.promoPriceCents != null && v.promoPriceCents < v.priceCents ? v.promoPriceCents : null
    return [
      {
        code: r.code,
        name: r.name,
        brand: r.brand.name,
        href: `/producto/${r.code}`,
        image: images.get(r.images[0] ?? '') ?? null,
        priceCents: v ? (promo ?? v.priceCents) : null,
        compareAtCents: promo != null && v ? v.priceCents : null,
        status: r.status,
        headline: r.headline,
      },
    ]
  })
}

export type RoutineTeaser = { code: string; name: string; goal: string; description: string | null; steps: number; moment: string; href: string }

/** Published routines; by code in that order, or all of them. */
export async function getRoutineTeasers(db: PrismaClient, codes: string[] | null): Promise<RoutineTeaser[]> {
  const rows = await db.routine.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, ...(codes?.length ? { code: { in: codes } } : {}) },
    select: { code: true, name: true, goal: true, description: true, moment: true, _count: { select: { steps: true } } },
    orderBy: { name: 'asc' },
  })
  const ordered = codes?.length ? codes.flatMap((c) => rows.filter((r) => r.code === c)) : rows
  return ordered.map((r) => ({ code: r.code, name: r.name, goal: r.goal, description: r.description, steps: r._count.steps, moment: r.moment, href: `/rutinas/${r.code}` }))
}

export type ConcernCard = { code: string; name: string; shortLabel: string; shortDescription: string | null; href: string }

/** Needs by code in that order; with no codes, every need alphabetically. */
export async function getConcernCards(db: PrismaClient, codes: string[]): Promise<ConcernCard[]> {
  const rows = await db.concern.findMany({ where: { deletedAt: null, ...(codes.length ? { code: { in: codes } } : {}) }, orderBy: { name: 'asc' } })
  const ordered = codes.length ? codes.flatMap((c) => rows.filter((r) => r.code === c)) : rows
  return ordered.map((r) => ({ code: r.code, name: r.name, shortLabel: r.shortLabel, shortDescription: r.shortDescription, href: `/necesidad/${r.code}` }))
}

export type BrandLogo = { code: string; name: string; href: string; logo: ResolvedImage | null }

/** Brands with at least one published product. */
export async function getBrandLogos(db: PrismaClient): Promise<BrandLogo[]> {
  const rows = await db.brand.findMany({ where: { deletedAt: null, products: { some: live } }, orderBy: { name: 'asc' } })
  const logos = await resolveImages(db, rows.map((r) => r.logoFile ?? ''))
  return rows.map((r) => ({ code: r.code, name: r.name, href: `/marca/${r.code}`, logo: logos.get(r.logoFile ?? '') ?? null }))
}
