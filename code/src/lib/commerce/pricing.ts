// Discount cascade (CMP-02, 03 §2 "Pricing and checkout", BO-07, CK-08).
// Pure: no database, no clock. The cart, the checkout and the order all price
// through here, so what the customer sees is what the order stores.
//
//   1. Routine discount or code discount: only the larger applies (BO-07).
//   2. Transfer discount on what is left, in cascade: 10% + 5% = 14,5%, not 15%.
//   3. The total discount never exceeds the configured cap (D-16, EB-C08).
//
// Every line carries its share of each discount, so commissions (EMB, X-03)
// and refunds work per line, on a base without shipping. Discounts are whole
// pesos, rounded down, so totals read the way Argentine shops show them.

export type PricingLine = {
  key: string
  /** Promo price if any, else list price, per unit. */
  unitChargedCents: number
  quantity: number
  /** Lines added together as one routine (BO-03). */
  routineGroup?: string | null
}

export type CodeDiscount = { kind: 'PERCENT' | 'AMOUNT'; value: number; combinesWithTransfer: boolean }

export type PricingInput = {
  lines: PricingLine[]
  /** Discount percent per complete routine group (H3 fills this; RUT-02). */
  routineGroups?: Record<string, number>
  code?: CodeDiscount | null
  /** Transfer discount percent; 0 when paying another way. */
  transferPct?: number
  /** Total discount cap as a percent of the subtotal; 0 or absent = no cap. */
  capPct?: number
}

export type PricedLine = { key: string; subtotalCents: number; discountCents: number; totalCents: number }

export type Pricing = {
  subtotalCents: number
  routineDiscountCents: number
  codeDiscountCents: number
  transferDiscountCents: number
  discountCents: number
  totalCents: number
  /** Which first-step discount applied. */
  applied: 'routine' | 'code' | null
  /** A code was given but the routine discount was larger (BO-07 message). */
  codeOutdone: boolean
  /** The cap cut the discounts down. */
  capped: boolean
  lines: PricedLine[]
}

const PESO = 100
const toPeso = (cents: number) => Math.floor(cents / PESO) * PESO
const clampPct = (n: number | undefined) => Math.min(100, Math.max(0, Number.isFinite(n) ? Number(n) : 0))

/**
 * Splits `amount` across `weights` in proportion, in whole pesos where the
 * amount allows it, so the parts always add up to the amount exactly
 * (largest remainder).
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (amount <= 0 || total <= 0) return weights.map(() => 0)
  const unit = amount % PESO === 0 ? PESO : 1
  const units = amount / unit
  const exact = weights.map((w) => (w / total) * units)
  const floor = exact.map(Math.floor)
  let left = units - floor.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floor[i]! += 1
    left -= 1
  }
  return floor.map((u) => u * unit)
}

export function priceCart(input: PricingInput): Pricing {
  const lines = input.lines.filter((l) => l.quantity > 0)
  const subtotals = lines.map((l) => l.unitChargedCents * l.quantity)
  const subtotalCents = subtotals.reduce((a, b) => a + b, 0)

  // Step 1a: routine discount, per complete routine group.
  const routineShare = lines.map(() => 0)
  for (const [group, pct] of Object.entries(input.routineGroups ?? {})) {
    const idx = lines.map((l, i) => (l.routineGroup === group ? i : -1)).filter((i) => i >= 0)
    const base = idx.reduce((a, i) => a + subtotals[i]!, 0)
    const amount = toPeso((base * clampPct(pct)) / 100)
    allocate(amount, idx.map((i) => subtotals[i]!)).forEach((a, k) => (routineShare[idx[k]!]! += a))
  }
  const routineTotal = routineShare.reduce((a, b) => a + b, 0)

  // Step 1b: code discount, on the whole subtotal.
  let codeTotal = 0
  if (input.code) {
    codeTotal =
      input.code.kind === 'PERCENT' ? toPeso((subtotalCents * clampPct(input.code.value)) / 100) : Math.min(subtotalCents, Math.max(0, Math.floor(input.code.value)))
  }
  const codeShare = allocate(codeTotal, subtotals)

  // The larger of the two; a tie goes to the routine (the code still records
  // an ambassador's commission, BO-07).
  const applied: Pricing['applied'] = routineTotal === 0 && codeTotal === 0 ? null : codeTotal > routineTotal ? 'code' : 'routine'
  const first = applied === 'code' ? codeShare : applied === 'routine' ? routineShare : lines.map(() => 0)
  const firstTotal = first.reduce((a, b) => a + b, 0)

  // Step 2: transfer, in cascade on what is left.
  const transferAllowed = !(applied === 'code' && input.code && !input.code.combinesWithTransfer)
  const transferPct = transferAllowed ? clampPct(input.transferPct) : 0
  const transferTotal = toPeso(((subtotalCents - firstTotal) * transferPct) / 100)
  let transfer = allocate(
    transferTotal,
    subtotals.map((s, i) => s - first[i]!),
  )

  // Step 3: the cap. Transfer gives way first, then the first step.
  let firstFinal = first
  let capped = false
  const capPct = clampPct(input.capPct)
  if (capPct > 0) {
    const cap = toPeso((subtotalCents * capPct) / 100)
    if (firstTotal + transferTotal > cap) {
      capped = true
      const transferAllowedAmount = Math.max(0, cap - firstTotal)
      transfer = allocate(Math.min(transferTotal, transferAllowedAmount), subtotals.map((s, i) => s - first[i]!))
      if (firstTotal > cap) firstFinal = allocate(cap, first)
    }
  }

  const firstFinalTotal = firstFinal.reduce((a, b) => a + b, 0)
  const transferFinalTotal = transfer.reduce((a, b) => a + b, 0)
  const priced = lines.map((l, i) => {
    const discountCents = firstFinal[i]! + transfer[i]!
    return { key: l.key, subtotalCents: subtotals[i]!, discountCents, totalCents: subtotals[i]! - discountCents }
  })
  const discountCents = firstFinalTotal + transferFinalTotal

  return {
    subtotalCents,
    routineDiscountCents: applied === 'routine' ? firstFinalTotal : 0,
    codeDiscountCents: applied === 'code' ? firstFinalTotal : 0,
    transferDiscountCents: transferFinalTotal,
    discountCents,
    totalCents: subtotalCents - discountCents,
    applied,
    codeOutdone: !!input.code && codeTotal > 0 && applied === 'routine',
    capped,
    lines: priced,
  }
}
