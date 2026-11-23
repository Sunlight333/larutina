// Product cards (NAV-04) for a set of catalog items, with their main image
// resolved in one query.
import type { RoutineStepType } from '@prisma/client'
import { getDb } from '@/server/db'
import { resolveImages, type ResolvedImage } from '@/server/media'
import type { CatalogItem } from './catalog'
import type { StockState } from './rules'

export type ProductCardData = {
  code: string
  name: string
  brand: { code: string; name: string }
  routineStep: RoutineStepType
  stepLabel: string
  image: ResolvedImage | null
  priceCents: number
  chargedCents: number
  /** "Nuevo", "Edición limitada"… */
  labels: string[]
  presale: string | null
  stock: StockState
  variants: { sku: string; sizeLabel: string; priceCents: number; chargedCents: number; available: boolean }[]
}

export async function toCards(items: CatalogItem[]): Promise<ProductCardData[]> {
  const refs = items.map((p) => p.image).filter((x): x is string => !!x)
  const images = refs.length ? await resolveImages(getDb(), refs) : new Map<string, ResolvedImage>()
  return items.map((p) => ({
    code: p.code,
    name: p.name,
    brand: { code: p.brand.code, name: p.brand.name },
    routineStep: p.routineStep,
    stepLabel: p.stepLabel,
    image: p.image ? images.get(p.image) ?? null : null,
    priceCents: p.main.priceCents,
    chargedCents: p.main.chargedCents,
    labels: p.labels,
    presale: p.presale,
    stock: p.stock,
    variants: p.variants.map((v) => ({ sku: v.sku, sizeLabel: v.sizeLabel, priceCents: v.priceCents, chargedCents: v.chargedCents, available: v.available })),
  }))
}
