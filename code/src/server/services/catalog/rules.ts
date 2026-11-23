// Catalog business rules as pure functions (03-data-model §2), so they are
// unit-tested without a database and shared by the listing, the product page,
// search and the cart API.
import type { Moment, Prisma, ProductLabel, ProductStatus, Unit } from '@prisma/client'
import { LABEL_TEXT, UNIT_SHORT } from './labels'

/** What the public site shows. Borrador and Archivado never are. */
export const PUBLISHED_STATUSES = ['ACTIVE', 'PRESALE', 'SOLD_OUT'] as const satisfies readonly ProductStatus[]

export function isPublishedStatus(status: ProductStatus): boolean {
  return (PUBLISHED_STATUSES as readonly ProductStatus[]).includes(status)
}

/** Published = a published status, not in the trash, and its brand not in the trash either. */
export const publishedProductWhere = (): Prisma.ProductWhereInput => ({
  status: { in: [...PUBLISHED_STATUSES] },
  deletedAt: null,
  brand: { deletedAt: null },
})

// ------------------------------------------------------------------ price ----

export type PriceFields = { priceCents: number; promoPriceCents: number | null }

/** The price actually charged: the promo price when there is one (it is always below the price). */
export function chargedCents(v: PriceFields): number {
  return v.promoPriceCents != null && v.promoPriceCents > 0 && v.promoPriceCents < v.priceCents ? v.promoPriceCents : v.priceCents
}

/** PDP-02: price per 100 ml, per 100 g or per unit, on the charged price. */
export function unitPrice(charged: number, size: number, unit: Unit): { cents: number; per: string } | null {
  if (!(size > 0)) return null
  if (unit === 'UNITS') return { cents: Math.round(charged / size), per: 'unidad' }
  return { cents: Math.round((charged * 100) / size), per: unit === 'ML' ? '100 ml' : '100 g' }
}

/**
 * PDP-02: price without national taxes (Ley 27.743), on the charged price,
 * with the product's VAT rate or the general one from the panel.
 */
export function priceWithoutNationalTaxes(charged: number, vatRate: number): number {
  if (!(vatRate > 0)) return charged
  return Math.round(charged / (1 + vatRate / 100))
}

// ------------------------------------------------------------------- size ----

const sizeFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

export function sizeLabel(size: number, unit: Unit): string {
  if (unit === 'UNITS') return `${sizeFormat.format(size)} ${size === 1 ? 'unidad' : 'unidades'}`
  return `${sizeFormat.format(size)} ${UNIT_SHORT[unit]}`
}

/**
 * CAT-09: how long a size lasts. The variant's own value; else the product's
 * for its main size; else an estimate proportional to the main size (a 30 ml
 * of a 200 ml toner lasts 30/200 of it). Different units cannot be compared,
 * so those fall back to the product value.
 */
export function variantDurationDays(
  variant: { size: number; unit: Unit; durationDays: number | null; isMain: boolean },
  product: { durationDays: number | null },
  main: { size: number; unit: Unit; durationDays: number | null } | undefined,
): number | null {
  if (variant.durationDays) return variant.durationDays
  if (variant.isMain || !main) return product.durationDays
  const mainDays = main.durationDays ?? product.durationDays
  if (!mainDays) return null
  if (main.unit !== variant.unit || !(main.size > 0)) return product.durationDays
  return Math.max(1, Math.round((mainDays * variant.size) / main.size))
}

// ----------------------------------------------------------------- labels ----

export type LabelSettings = { newDays: number; dermatologistEnabled: boolean }

/** CAT-12: "Nuevo" for N days after the first publication (0 turns it off), or set by hand. */
export function isNew(publishedAt: Date | null, newDays: number, now = new Date()): boolean {
  if (!publishedAt || !(newDays > 0)) return false
  return now.getTime() - publishedAt.getTime() < newDays * 86_400_000
}

export function cardLabels(p: { labels: ProductLabel[]; publishedAt: Date | null }, s: LabelSettings, now = new Date()): string[] {
  const out: string[] = []
  if (p.labels.includes('NEW') || isNew(p.publishedAt, s.newDays, now)) out.push(LABEL_TEXT.NEW)
  if (p.labels.includes('LIMITED_EDITION')) out.push(LABEL_TEXT.LIMITED_EDITION)
  // Locked until LaRutina signs with a dermatologist (S-18).
  if (s.dermatologistEnabled && p.labels.includes('DERMATOLOGIST_RECOMMENDED')) out.push(LABEL_TEXT.DERMATOLOGIST_RECOMMENDED)
  return out
}

// ------------------------------------------------------------------ stock ----

export type StockState = 'available' | 'presale' | 'out'

/** Can this size be added to the cart? Pre-sale sells without stock (NAV-08); Agotado never. */
export function variantAvailable(status: ProductStatus, stock: number): boolean {
  if (status === 'PRESALE') return true
  if (status === 'SOLD_OUT' || status === 'ARCHIVED') return false
  return stock > 0
}

export function stockState(status: ProductStatus, variants: { stock: number }[]): StockState {
  if (status === 'PRESALE') return 'presale'
  return variants.some((v) => variantAvailable(status, v.stock)) ? 'available' : 'out'
}

const presaleDay = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const presaleDayYear = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** G-14: "Preventa · llega el 20 de enero". The date is a calendar date (stored at UTC midnight). */
export function presaleLabel(date: Date | null, now = new Date()): string {
  if (!date) return 'Preventa'
  const fmt = date.getUTCFullYear() === now.getUTCFullYear() ? presaleDay : presaleDayYear
  return `Preventa · llega el ${fmt.format(date)}`
}

// ---------------------------------------------------------------- moments ----

/** NAV-02: an "AM y PM" product appears both in the morning and in the night filter. */
export function momentMatches(productMoment: Moment, wanted: 'AM' | 'PM'): boolean {
  return productMoment === wanted || productMoment === 'BOTH'
}

// ------------------------------------------------------------------- text ----

/** "CALMÁ: reduce rojeces" → { verb: "CALMÁ", text: "reduce rojeces" } (F-12). */
export function parseBenefits(items: string[]): { verb: string | null; text: string }[] {
  return items
    .flatMap((i) => i.split('|'))
    .map((i) => i.trim())
    .filter(Boolean)
    .map((i) => {
      const at = i.indexOf(':')
      if (at > 0 && at <= 30) return { verb: i.slice(0, at).trim().toLocaleUpperCase('es-AR'), text: i.slice(at + 1).trim() }
      return { verb: null, text: i }
    })
}

/** Panel texts are plain text: one paragraph per line. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** The first sentence, cut at a word to fit `max` characters (meta descriptions, S-34). */
export function firstSentence(text: string | null | undefined, max = 155): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean
  return clip(sentence, max)
}

export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`
}

/** "Ácido exfoliante (AHA, BHA)" → "ácido exfoliante (AHA, BHA)" mid-sentence; acronyms ("NAD+") stay. */
export function lowerFirst(text: string): string {
  const [a, b] = [text.charAt(0), text.charAt(1)]
  return b && b === b.toLocaleLowerCase('es-AR') && b !== b.toLocaleUpperCase('es-AR') ? a.toLocaleLowerCase('es-AR') + text.slice(1) : text
}

const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

/** A value or, when empty, the fallback (travel sizes inheriting from their base product). */
export function orInherit<T>(own: T, base: T | undefined): T {
  return empty(own) && base !== undefined ? base : own
}

// ------------------------------------------------------------------ draft ----

// ADM-02: the panel keeps pending edits of a published product in
// Product.draft, a partial object of Product scalar fields with their Prisma
// names. The preview lays them over the columns; nothing else reads them.
const DRAFT_STRINGS = [
  'name', 'shortDescription', 'description', 'whyWeChose', 'howToUse', 'precautions', 'texture', 'textureDescription', 'tips',
  'line', 'headline', 'anmatRegistration', 'importerHolder', 'countryOfOrigin', 'inciText', 'videoUrl', 'seoTitle', 'seoDescription',
  'brandId', 'categoryId', 'evaluationNotes',
] as const
const DRAFT_STRING_LISTS = ['benefits', 'chips', 'images', 'kitContents', 'labels'] as const
const DRAFT_NUMBERS = ['durationDays', 'priority', 'paoMonths', 'vatRate', 'manualOrder', 'evaluationScore'] as const
const DRAFT_ENUMS = ['routineStep', 'moment', 'level', 'type', 'vegan', 'crueltyFree', 'dermatologistTested'] as const
const REQUIRED = new Set<string>(['name', 'shortDescription', 'description', 'whyWeChose', 'howToUse', 'texture', 'brandId', 'categoryId', 'routineStep', 'moment', 'type'])

export function overlayDraft<T extends Record<string, unknown>>(product: T, draft: unknown): T {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return product
  const d = draft as Record<string, unknown>
  const out: Record<string, unknown> = { ...product }
  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k)
  for (const k of DRAFT_STRINGS) {
    if (!has(k)) continue
    const v = d[k]
    if (typeof v === 'string') out[k] = v
    else if (v === null && !REQUIRED.has(k)) out[k] = null
  }
  for (const k of DRAFT_STRING_LISTS) {
    const v = d[k]
    if (has(k) && Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
  }
  for (const k of DRAFT_NUMBERS) {
    if (!has(k)) continue
    const v = d[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) out[k] = Number(v)
    else if (v === null) out[k] = null
  }
  for (const k of DRAFT_ENUMS) {
    const v = d[k]
    if (has(k) && (typeof v === 'string' || (v === null && !REQUIRED.has(k)))) out[k] = v
  }
  if (has('presaleDate')) {
    const v = d.presaleDate
    if (v === null) out.presaleDate = null
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const date = new Date(`${v.slice(0, 10)}T00:00:00Z`)
      if (!Number.isNaN(date.getTime())) out.presaleDate = date
    }
  }
  return out as T
}
