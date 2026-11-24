// Shipping quotes for the cart (BO-08), the product page (PDP-06) and the
// checkout (CK-06), all through here so they always agree. The provider is
// asked first; if it is not configured, fails or takes too long, the zone
// table from the panel answers instead and the purchase never stops (ENV-03).
// Home delivery only (D-03). Over the free-shipping threshold the cheapest
// option is free (ENV-02, BO-05).
import type { Prisma, PrismaClient } from '@prisma/client'
import { provincesForPostcode, parsePostcode } from '@/lib/argentina'
import { chooseBox, type Box, type Parcel } from '@/lib/commerce/boxes'
import { shippingProvider, type ShippingOption, type ShippingProvider } from './provider'

type Db = PrismaClient | Prisma.TransactionClient

export type QuoteOption = ShippingOption & { fallback: boolean; free: boolean; originalPriceCents: number; boxCode: string | null; weightGrams: number }

export type QuoteResult =
  | { ok: true; options: QuoteOption[]; fallback: boolean; boxReason: string }
  | { ok: false; error: 'postcode' | 'no-rates' }

const PROVIDER_TIMEOUT_MS = 5000

export async function loadBoxes(db: Db): Promise<Box[]> {
  const rows = await db.shippingBox.findMany({ where: { active: true } })
  return rows.map((b) => ({ code: b.code, heightCm: Number(b.heightCm), widthCm: Number(b.widthCm), lengthCm: Number(b.lengthCm), emptyWeightGrams: b.emptyWeightGrams, maxWeightGrams: b.maxWeightGrams, isDefault: b.isDefault }))
}

/** ENV-03: the zone table. With a four-digit postcode the province can be one of a few; the dearest of them quotes, so the estimate never comes in low. */
export async function fallbackOptions(db: Db, provinces: string[]): Promise<ShippingOption[]> {
  if (!provinces.length) return []
  const rates = await db.shippingRate.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  const zoneOf = (province: string) => rates.filter((r) => r.provinces.includes(province))
  const perProvince = provinces.map(zoneOf)
  if (perProvince.some((z) => !z.length)) {
    // A province with no zone cannot be quoted from the table.
    if (perProvince.every((z) => !z.length)) return []
  }
  const candidates = perProvince.filter((z) => z.length)
  // Group by carrier: for each carrier, the highest price among the candidate provinces.
  const byCarrier = new Map<string, ShippingOption>()
  for (const zone of candidates) {
    for (const r of zone) {
      const prev = byCarrier.get(r.carrier)
      if (!prev || r.priceCents > prev.priceCents) {
        byCarrier.set(r.carrier, { provider: 'tabla', carrier: r.carrier, service: r.zone, priceCents: r.priceCents, minDays: r.minDays, maxDays: r.maxDays })
      }
    }
  }
  return [...byCarrier.values()]
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([p, new Promise<never>((_, reject) => (t = setTimeout(() => reject(new Error('timeout')), ms)))])
  } finally {
    clearTimeout(t)
  }
}

export async function quoteShipping(
  db: Db,
  input: {
    postcode: string
    province?: string | null
    parcels: Parcel[]
    /** After discounts: what the free-shipping threshold compares with. */
    goodsCents: number
    freeFromCents: number
    maxOptions: number
  },
  provider: ShippingProvider | null = shippingProvider(),
): Promise<QuoteResult> {
  const postcode = parsePostcode(input.postcode)
  if (!postcode) return { ok: false, error: 'postcode' }
  const provinces = input.province ? [input.province] : provincesForPostcode(input.postcode)
  const choice = chooseBox(input.parcels, await loadBoxes(db))
  const boxCode = choice.box?.code ?? null

  let options: ShippingOption[] = []
  let fallback = false
  if (provider) {
    try {
      options = await withTimeout(
        provider.quote({ postcode: postcode.cpa ?? postcode.digits, province: provinces.length === 1 ? provinces[0]! : null, weightGrams: choice.weightGrams, box: choice.box, valueCents: input.goodsCents }),
        PROVIDER_TIMEOUT_MS,
      )
    } catch (e) {
      console.error('[shipping] provider quote failed, using the fallback rates:', (e as Error).message)
      options = []
    }
  }
  if (!options.length) {
    fallback = true
    options = await fallbackOptions(db, provinces)
  }
  if (!options.length) return { ok: false, error: 'no-rates' }

  const sorted = [...options].sort((a, b) => a.priceCents - b.priceCents).slice(0, Math.max(1, input.maxOptions))
  const freeApplies = input.freeFromCents > 0 && input.goodsCents >= input.freeFromCents
  return {
    ok: true,
    fallback,
    boxReason: choice.reason,
    options: sorted.map((o, i) => ({
      ...o,
      fallback,
      free: freeApplies && i === 0,
      originalPriceCents: o.priceCents,
      priceCents: freeApplies && i === 0 ? 0 : o.priceCents,
      boxCode,
      weightGrams: choice.weightGrams,
    })),
  }
}

/** The key an option is chosen by at checkout, stable across re-quotes. */
export const optionKey = (o: Pick<ShippingOption, 'provider' | 'carrier' | 'service'>) => `${o.provider}|${o.carrier}|${o.service}`
