// ADM-05: the price of a variant at the largest discount it can get, against
// its cost. The largest discount is the larger of its routine discount or the
// best active percentage code, then the transfer discount on top, never more
// than the total cap: exactly the cascade the cart applies (CMP-02). Pure.
import { priceCart } from './pricing'

export type MarginInput = {
  chargedCents: number
  costCents: number
  /** Largest discount_pct among published routines that include the product. */
  routinePct: number
  /** Largest percentage among active codes (and the ambassador code, H3). */
  codePct: number
  transferPct: number
  capPct: number
}

export function worstCase(input: MarginInput) {
  const p = priceCart({
    lines: [{ key: 'v', unitChargedCents: input.chargedCents, quantity: 1, routineGroup: input.routinePct > 0 ? 'r' : null }],
    routineGroups: input.routinePct > 0 ? { r: input.routinePct } : {},
    code: input.codePct > 0 ? { kind: 'PERCENT', value: input.codePct, combinesWithTransfer: true } : null,
    transferPct: input.transferPct,
    capPct: input.capPct,
  })
  return { lowestCents: p.totalCents, discountPct: input.chargedCents ? Math.round((p.discountCents / input.chargedCents) * 1000) / 10 : 0, belowCost: p.totalCents < input.costCents, marginCents: p.totalCents - input.costCents }
}
