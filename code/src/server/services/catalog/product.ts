// The product page (PDP-01..03 and the CAT display fields). Everything the
// page shows is computed here; the page only lays it out. A block without
// data comes back empty, and the page leaves it out (PDP-01).
import type { ConflictSeverity, Prisma, ProductStatus, RoutineStepType, Moment, Aptitude, ProductType, ProductLabel } from '@prisma/client'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { resolveImages, type ResolvedImage } from '@/server/media'
import { getCatalog, type CatalogItem } from './catalog'
import { APTITUDE_LABELS, MOMENT_LABELS, SEAL_LABELS, STEP_LABELS } from './labels'
import {
  cardLabels,
  clip,
  isPublishedStatus,
  lowerFirst,
  orInherit,
  overlayDraft,
  paragraphs,
  parseBenefits,
  presaleLabel,
  priceWithoutNationalTaxes,
  stockState,
  unitPrice,
  variantDurationDays,
  type StockState,
} from './rules'
import { toCatalogVariants } from './catalog'
import { ingredientPageCodes } from './taxonomy'
import { absoluteUrl } from './seo'

const ingredientInclude = {
  ingredients: { include: { ingredient: { include: { family: true } } }, orderBy: { inciOrder: 'asc' } },
  concerns: { include: { concern: true } },
  skinTypes: { include: { skinType: true } },
} satisfies Prisma.ProductInclude

const detailInclude = {
  ...ingredientInclude,
  brand: true,
  category: true,
  variants: true,
  relations: { orderBy: { position: 'asc' }, include: { related: { select: { code: true } } } },
  evaluations: { include: { criterion: true } },
  baseProduct: { include: { ...ingredientInclude, brand: { select: { deletedAt: true } } } },
} satisfies Prisma.ProductInclude

type DetailRow = Prisma.ProductGetPayload<{ include: typeof detailInclude }>

export type Viewer = { team: boolean; preview: boolean }

export type VideoSource = { kind: 'file'; src: string } | { kind: 'embed'; src: string } | null

/** CAT-17: an uploaded MP4 (media key or file name) or an external URL; YouTube and Vimeo play embedded. */
export function videoSource(url: string | null | undefined): VideoSource | { kind: 'media'; ref: string } {
  const v = url?.trim()
  if (!v) return null
  const yt = v.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,20})/)
  if (yt) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  const vimeo = v.match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/)
  if (vimeo) return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  if (/^https:\/\//.test(v)) return { kind: 'file', src: v }
  if (/^http:\/\//.test(v)) return null // mixed content would be blocked
  return { kind: 'media', ref: v }
}

export type BuyVariant = {
  sku: string
  sizeLabel: string
  priceCents: number
  promoPriceCents: number | null
  chargedCents: number
  unitPrice: { cents: number; per: string } | null
  withoutTaxesCents: number
  durationDays: number | null
  available: boolean
  isMain: boolean
}

export type Conflict = { with: string[]; note: string; severity: ConflictSeverity }

export type ProductDetail = {
  id: string
  code: string
  name: string
  status: ProductStatus
  type: ProductType
  /** Shown to the team only: draft, archived, or a preview of pending edits. */
  banner: string | null
  /** Published: it can be added to the cart (a draft cannot, even for the team). */
  published: boolean
  indexable: boolean
  brand: { code: string; name: string; description: string[] }
  category: { code: string; name: string } | null
  breadcrumb: { label: string; href?: string }[]
  baseProduct: { code: string; name: string } | null
  headline: string | null
  chips: string[]
  labels: string[]
  seals: string[]
  shortDescription: string[]
  description: string[]
  benefits: { verb: string | null; text: string }[]
  whyWeChose: string[]
  howToUse: string[]
  moment: Moment
  momentLabel: string
  routineStep: RoutineStepType
  stepLabel: string
  texture: string | null
  textureDescription: string[]
  tips: string[]
  concerns: { code: string; name: string }[]
  skinTypes: { aptitude: Aptitude; label: string; names: string[] }[]
  stars: { code: string; name: string; inciName: string; concentration: string | null; description: string | null; href: string | null }[]
  inci: { items: { name: string; star: boolean; href: string | null }[] } | { text: string } | null
  precautions: { text: string[]; warnings: string[]; conflicts: Conflict[] }
  info: { label: string; value: string }[]
  presale: string | null
  stock: StockState
  variants: BuyVariant[]
  vatRate: number
  images: (ResolvedImage & { alt: string })[]
  video: VideoSource
  kit: { name: string; sizeLabel: string; href: string | null }[]
  sameLine: { name: string; items: CatalogItem[] } | null
  relations: { kind: string; title: string; text: string | null; items: CatalogItem[] }[]
  routines: { code: string; name: string }[]
  evaluation: { score: number; notes: string | null; criteria: { name: string; score: number; note: string | null }[] } | null
  seo: { title: string | null; description: string; image: (ResolvedImage & { alt: string }) | null }
  jsonLd: Record<string, unknown>
}

/** Product scalars as plain values, so the draft overlay can replace any of them. */
function scalars(row: DetailRow) {
  return {
    name: row.name,
    brandId: row.brandId,
    categoryId: row.categoryId,
    type: row.type,
    shortDescription: row.shortDescription,
    description: row.description,
    benefits: row.benefits,
    whyWeChose: row.whyWeChose,
    evaluationScore: row.evaluationScore,
    evaluationNotes: row.evaluationNotes,
    howToUse: row.howToUse,
    precautions: row.precautions,
    texture: row.texture,
    textureDescription: row.textureDescription,
    tips: row.tips,
    routineStep: row.routineStep,
    moment: row.moment,
    durationDays: row.durationDays,
    level: row.level,
    priority: row.priority,
    kitContents: row.kitContents,
    line: row.line,
    headline: row.headline,
    chips: row.chips,
    labels: row.labels as string[],
    vegan: row.vegan as string,
    crueltyFree: row.crueltyFree as string,
    dermatologistTested: row.dermatologistTested as string,
    anmatRegistration: row.anmatRegistration,
    importerHolder: row.importerHolder,
    countryOfOrigin: row.countryOfOrigin,
    paoMonths: row.paoMonths,
    vatRate: row.vatRate == null ? null : Number(row.vatRate),
    inciText: row.inciText,
    images: row.images,
    videoUrl: row.videoUrl,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    presaleDate: row.presaleDate,
    manualOrder: row.manualOrder,
  }
}

const SEVERITY_ORDER: Record<ConflictSeverity, number> = { AVOID: 0, CAUTION: 1, ALTERNATE_DAYS: 2 }

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

function dedupeChips(chips: string[]): string[] {
  const seen = new Set<string>()
  return chips.filter((c) => {
    const k = norm(c)
    if (!c.trim() || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * The product page data, or null when the visitor may not see it: a
 * published product for everyone; a draft or archived one for the team,
 * with a banner; with `preview`, the team sees the pending edits (ADM-02).
 */
export async function getProductDetail(code: string, viewer: Viewer, opts: { preview?: boolean } = {}): Promise<ProductDetail | null> {
  const db = getDb()
  const row = await db.product.findFirst({ where: { code, deletedAt: null }, include: detailInclude })
  if (!row) return null
  const isTeam = viewer.team || viewer.preview
  const published = isPublishedStatus(row.status) && !row.brand.deletedAt
  if (!published && !isTeam) return null

  const preview = isTeam && !!opts.preview
  const f = preview ? overlayDraft(scalars(row), row.draft) : scalars(row)
  const [s, catalog] = await Promise.all([getSettings(), getCatalog()])
  const now = new Date()

  // The overlay may move the product to another brand or category.
  const brand = f.brandId === row.brandId ? row.brand : ((await db.brand.findUnique({ where: { id: f.brandId } })) ?? row.brand)
  const category = f.categoryId === row.categoryId ? row.category : ((await db.category.findUnique({ where: { id: f.categoryId } })) ?? row.category)
  const parentCategory = category.parentId ? await db.category.findFirst({ where: { id: category.parentId, deletedAt: null } }) : null

  // CAT-07: a travel size takes INCI, needs, skin types and texts from its base product.
  const base = f.type === 'TRAVEL_SIZE' && row.baseProduct && !row.baseProduct.deletedAt ? row.baseProduct : null
  // The base row has every scalar column; scalars() reads nothing else.
  const baseFields = base ? scalars(base as unknown as DetailRow) : undefined
  const text = <K extends keyof typeof f>(k: K) => orInherit(f[k], baseFields?.[k])
  const ingredients = orInherit(row.ingredients, base?.ingredients)
  const concernRows = orInherit(row.concerns, base?.concerns)
  const skinRows = orInherit(row.skinTypes, base?.skinTypes)
  const flags = row.ingredients.length === 0 && base ? base : row
  const hasInci = ingredients.length > 0

  // ---- prices (PDP-02) and durations (CAT-09)
  const vatRate = f.vatRate ?? s['catalog.vatRate']
  const variantsRaw = row.variants.map((v) => ({ ...v, size: Number(v.size) }))
  const mainRaw = variantsRaw.find((v) => v.isMain) ?? variantsRaw[0]
  const variants: BuyVariant[] = toCatalogVariants(row.status, row.variants).map((v) => {
    const raw = variantsRaw.find((r) => r.sku === v.sku)!
    return {
      sku: v.sku,
      sizeLabel: v.sizeLabel,
      priceCents: v.priceCents,
      promoPriceCents: v.promoPriceCents,
      chargedCents: v.chargedCents,
      unitPrice: unitPrice(v.chargedCents, v.size, v.unit),
      withoutTaxesCents: priceWithoutNationalTaxes(v.chargedCents, vatRate),
      durationDays: variantDurationDays(raw, { durationDays: f.durationDays }, mainRaw),
      // A draft cannot be bought yet, even by the team previewing it.
      available: published && v.available,
      isMain: v.isMain,
    }
  })
  const main = variants[0]

  // ---- needs (relevance ≥ setting) and skin types (F-10)
  const minRelevance = s['catalog.pdpRelevance']
  const concerns = concernRows
    .filter((c) => !c.concern.deletedAt && c.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .map((c) => ({ code: c.concern.code, name: c.concern.name }))
  const aptitudes: Aptitude[] = ['IDEAL', 'SUITABLE', 'CAUTION', 'NOT_RECOMMENDED']
  const skinTypes = aptitudes
    .map((a) => ({ aptitude: a, label: APTITUDE_LABELS[a], names: skinRows.filter((r) => r.aptitude === a && !r.skinType.deletedAt).map((r) => lowerFirst(r.skinType.name)) }))
    .filter((g) => g.names.length > 0)

  // ---- ingredients (F-11, F-23)
  const pages = await ingredientPageCodes(db, ingredients.map((i) => i.ingredientId))
  const href = (code: string) => (pages.has(code) ? `/ingrediente/${code}` : null)
  const stars = ingredients
    .filter((i) => i.isStar && !i.ingredient.deletedAt)
    .map((i) => ({
      code: i.ingredient.code,
      name: i.ingredient.commonName,
      inciName: i.ingredient.inciName,
      concentration: i.concentration?.trim() || null,
      description: i.ingredient.description?.trim() || null,
      href: href(i.ingredient.code),
    }))
  const inciText = text('inciText')
  const inci = hasInci
    ? { items: ingredients.map((i) => ({ name: i.ingredient.inciName, star: i.isStar, href: href(i.ingredient.code) })) }
    : inciText?.trim()
      ? { text: inciText.trim() }
      : null

  // ---- precautions (PDP-03): own text or the generic one, plus family warnings and conflict notes
  const families = new Map<string, { name: string; warning: string | null }>()
  for (const i of ingredients) if (i.ingredient.family) families.set(i.ingredient.family.id, i.ingredient.family)
  const warnings = [...new Set([...families.values()].map((fam) => fam.warning?.trim()).filter((w): w is string => !!w))]
  const ingredientIds = ingredients.map((i) => i.ingredientId)
  const familyIds = [...families.keys()]
  const [ingConflicts, famConflicts] = await Promise.all([
    ingredientIds.length
      ? db.ingredientConflict.findMany({
          where: { OR: [{ ingredientAId: { in: ingredientIds } }, { ingredientBId: { in: ingredientIds } }] },
          include: { ingredientA: { select: { id: true, commonName: true } }, ingredientB: { select: { id: true, commonName: true } } },
        })
      : [],
    familyIds.length
      ? db.familyConflict.findMany({
          where: { OR: [{ familyAId: { in: familyIds } }, { familyBId: { in: familyIds } }] },
          include: { familyA: { select: { id: true, name: true } }, familyB: { select: { id: true, name: true } } },
        })
      : [],
  ])
  const ownIngredients = new Set(ingredientIds)
  const ownFamilies = new Set(familyIds)
  const conflictMap = new Map<string, Conflict>()
  const addConflict = (other: string, note: string | null, severity: ConflictSeverity) => {
    const n = note?.trim()
    if (!n) return
    const existing = conflictMap.get(n)
    if (existing) {
      if (!existing.with.includes(other)) existing.with.push(other)
      if (SEVERITY_ORDER[severity] < SEVERITY_ORDER[existing.severity]) existing.severity = severity
    } else conflictMap.set(n, { with: [other], note: n, severity })
  }
  for (const c of ingConflicts) {
    const other = ownIngredients.has(c.ingredientAId) ? c.ingredientB : c.ingredientA
    addConflict(lowerFirst(other.commonName), c.note, c.severity)
  }
  for (const c of famConflicts) {
    const other = ownFamilies.has(c.familyAId) ? c.familyB : c.familyA
    addConflict(lowerFirst(other.name), c.note, c.severity)
  }
  const conflicts = [...conflictMap.values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const ownPrecautions = text('precautions')?.trim()
  const precautions = { text: paragraphs(ownPrecautions || s['catalog.genericPrecautions']), warnings, conflicts }

  // ---- chips (CAT-13): size and step come on their own, and "Sin fragancia" from the INCI
  const stepLabel = STEP_LABELS[f.routineStep as RoutineStepType] ?? STEP_LABELS[row.routineStep]
  const fragranceFree = hasInci && flags.fragranceFree
  const chips = dedupeChips([main?.sizeLabel ?? '', stepLabel, ...f.chips.slice(0, 3), fragranceFree ? 'Sin fragancia' : ''])

  // ---- seals (CAT-14): only "Sí" shows
  const seals = (Object.keys(SEAL_LABELS) as (keyof typeof SEAL_LABELS)[]).filter((k) => f[k] === 'YES').map((k) => SEAL_LABELS[k])

  // ---- product information (CAT-10, CAT-16)
  const origin = f.countryOfOrigin?.trim() || brand.countryOfOrigin?.trim()
  const sizes = [...new Set(variants.map((v) => v.sizeLabel))]
  const info = [
    f.anmatRegistration?.trim() && { label: 'Registro ANMAT', value: f.anmatRegistration.trim() },
    f.importerHolder?.trim() && { label: 'Titular o importador', value: f.importerHolder.trim() },
    origin && { label: 'País de origen', value: origin },
    sizes.length > 0 && { label: sizes.length > 1 ? 'Contenido neto (tamaños)' : 'Contenido neto', value: sizes.join(' · ') },
    f.paoMonths && { label: 'Una vez abierto, usalo dentro de', value: `${f.paoMonths} ${f.paoMonths === 1 ? 'mes' : 'meses'}` },
  ].filter((x): x is { label: string; value: string } => !!x)

  // ---- gallery (F-02, CAT-17)
  const resolved = await resolveImages(db, f.images)
  const altFor = (n: number) => (n === 0 ? `${f.name}, de ${brand.name}` : n === 1 ? `${f.name}, en uso` : n === 2 ? `Textura de ${f.name}` : `${f.name}, foto ${n + 1}`)
  const images = f.images
    .map((ref) => resolved.get(ref))
    .filter((x): x is ResolvedImage => !!x)
    .map((img, n) => ({ ...img, alt: img.alt?.trim() || altFor(n) }))
  let video: VideoSource = null
  const vs = videoSource(f.videoUrl)
  if (vs?.kind === 'media') {
    const asset = (await resolveImages(db, [vs.ref])).get(vs.ref)
    if (asset) video = { kind: 'file', src: asset.src }
  } else video = vs

  // ---- kit contents (CAT-07)
  const kitSkus = f.type === 'KIT' ? f.kitContents.map((k) => k.trim()).filter(Boolean) : []
  const kitVariants = kitSkus.length
    ? await db.productVariant.findMany({ where: { sku: { in: kitSkus } }, include: { product: { select: { code: true, name: true, status: true, deletedAt: true } } } })
    : []
  const publishedCodes = new Set(catalog.map((p) => p.code))
  const kit = kitSkus
    .map((sku) => kitVariants.find((v) => v.sku === sku))
    .filter((v): v is (typeof kitVariants)[number] => !!v && !v.product.deletedAt)
    .map((v) => ({ name: v.product.name, sizeLabel: toCatalogVariants(v.product.status, [v])[0]!.sizeLabel, href: publishedCodes.has(v.product.code) ? `/producto/${v.product.code}` : null }))

  // ---- same line (CAT-15) and relations (F-19)
  const byCode = new Map(catalog.map((p) => [p.code, p]))
  const line = f.line?.trim()
  const sameLineItems = line ? catalog.filter((p) => p.code !== row.code && p.brand.code === brand.code && p.line && norm(p.line) === norm(line)).sort((a, b) => a.name.localeCompare(b.name, 'es')) : []
  const RELATION_COPY = {
    COMPATIBLE: { title: 'Combina bien con', text: 'Productos de otros pasos que trabajan lo mismo.' },
    COMPLEMENTARY: { title: 'Para completar la rutina', text: null },
    ALTERNATIVE: { title: 'Otras opciones para el mismo paso', text: null },
  } as const
  const relations = (['COMPATIBLE', 'COMPLEMENTARY', 'ALTERNATIVE'] as const)
    .map((kind) => ({
      kind,
      ...RELATION_COPY[kind],
      items: row.relations.filter((r) => r.kind === kind && r.related.code !== row.code).map((r) => byCode.get(r.related.code)).filter((p): p is CatalogItem => !!p),
    }))
    .filter((r) => r.items.length > 0)

  // ---- routines it appears in (F-18): published ones only
  const routines = await db.routine.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, steps: { some: { OR: [{ mainProductId: row.id }, { alternatives: { some: { productId: row.id } } }] } } },
    select: { code: true, name: true },
    orderBy: { name: 'asc' },
  })

  // ---- evaluation (CAT-18): hidden until the method is published (D-10)
  const evaluation =
    s['catalog.evaluationVisible'] && f.evaluationScore != null
      ? {
          score: f.evaluationScore,
          notes: f.evaluationNotes,
          criteria: row.evaluations.map((e) => ({ name: e.criterion.name, score: e.score, note: e.note })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
        }
      : null

  const status = row.status
  const banner = preview
    ? 'Vista previa del equipo: así se va a ver con los cambios sin publicar.'
    : !published
      ? status === 'ARCHIVED'
        ? 'Archivado: las visitas no ven este producto.'
        : 'Borrador: las visitas no ven este producto hasta publicarlo.'
      : null

  const shortDescription = text('shortDescription')
  const headline = text('headline')?.trim() || null
  const seoDescription = f.seoDescription?.trim() || clip([headline && `${headline}.`, shortDescription].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), 155)
  const productUrl = absoluteUrl(`/producto/${row.code}`)
  const availability = (v: BuyVariant) => (status === 'PRESALE' ? 'https://schema.org/PreOrder' : v.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock')

  const baseInfo = base && isPublishedStatus(base.status) && !base.brand.deletedAt ? { code: base.code, name: base.name } : null

  return {
    id: row.id,
    code: row.code,
    name: f.name,
    status,
    type: f.type as ProductType,
    banner,
    published,
    indexable: published && !preview,
    brand: { code: brand.code, name: brand.name, description: paragraphs(brand.description) },
    category: category.deletedAt ? null : { code: category.code, name: category.name },
    breadcrumb: [
      { label: 'Inicio', href: '/' },
      { label: 'Productos', href: '/productos' },
      ...(parentCategory ? [{ label: parentCategory.name, href: `/categoria/${parentCategory.code}` }] : []),
      ...(category.deletedAt ? [] : [{ label: category.name, href: `/categoria/${category.code}` }]),
      { label: f.name },
    ],
    baseProduct: baseInfo,
    headline,
    chips,
    labels: cardLabels({ labels: f.labels as ProductLabel[], publishedAt: row.publishedAt }, { newDays: s['catalog.newDays'], dermatologistEnabled: s['catalog.dermatologistLabelEnabled'] }, now),
    seals,
    shortDescription: paragraphs(shortDescription),
    description: paragraphs(text('description')),
    benefits: parseBenefits(text('benefits')),
    whyWeChose: paragraphs(text('whyWeChose')),
    howToUse: paragraphs(text('howToUse')),
    moment: f.moment as Moment,
    momentLabel: MOMENT_LABELS[f.moment as Moment] ?? MOMENT_LABELS[row.moment],
    routineStep: f.routineStep as RoutineStepType,
    stepLabel,
    texture: text('texture')?.trim() || null,
    textureDescription: paragraphs(text('textureDescription')),
    tips: paragraphs(text('tips')),
    concerns,
    skinTypes,
    stars,
    inci,
    precautions,
    info,
    presale: status === 'PRESALE' ? presaleLabel(f.presaleDate, now) : null,
    stock: stockState(status, row.variants),
    variants,
    vatRate,
    images,
    video,
    kit,
    sameLine: sameLineItems.length && line ? { name: line, items: sameLineItems } : null,
    relations,
    routines,
    evaluation,
    seo: { title: f.seoTitle?.trim() || null, description: seoDescription, image: images[0] ?? null },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: f.name,
      description: seoDescription || undefined,
      sku: main?.sku,
      brand: { '@type': 'Brand', name: brand.name },
      category: category.name,
      image: images.length ? images.map((i) => absoluteUrl(i.src)) : undefined,
      url: productUrl,
      // No aggregateRating: there are no verified reviews yet (F-06).
      offers: variants.map((v) => ({
        '@type': 'Offer',
        sku: v.sku,
        name: `${f.name} ${v.sizeLabel}`,
        price: (v.chargedCents / 100).toFixed(2),
        priceCurrency: 'ARS',
        availability: availability(v),
        url: productUrl,
      })),
    },
  }
}
