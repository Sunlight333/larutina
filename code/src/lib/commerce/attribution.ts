// Which ambassador an order belongs to (EMB-02, EMB-03, IR-17, EB-C03). Pure.
//
// Priority, highest first:
//   1. CODE     her code typed in the cart or checkout code field
//   2. CART     her code saved on the cart from her link (?ref, /r/CODE)
//   3. COOKIE   her link on this device within the window
//   4. ACCOUNT  her link saved on the customer's account within the window
// One ambassador per order. No commission on her own purchases (same email,
// same account, or the DNI inside her CUIT).

export type Source = 'CODE' | 'CART' | 'COOKIE' | 'ACCOUNT'
export type Candidate = { ambassadorId: string; code: string; at?: Date | null }

export type AttributionInput = {
  code?: Candidate | null
  cart?: Candidate | null
  cookie?: Candidate | null
  account?: Candidate | null
  windowDays: number
  now: Date
}

export function resolveAttribution(input: AttributionInput): (Candidate & { source: Source }) | null {
  const live = (c: Candidate | null | undefined) => !!c && (!c.at || input.now.getTime() - c.at.getTime() <= input.windowDays * 86_400_000)
  if (input.code) return { ...input.code, source: 'CODE' }
  if (input.cart) return { ...input.cart, source: 'CART' }
  if (live(input.cookie)) return { ...input.cookie!, source: 'COOKIE' }
  if (live(input.account)) return { ...input.account!, source: 'ACCOUNT' }
  return null
}

export type SelfCheck = {
  ambassador: { email: string; customerId: string | null; cuit: string | null }
  order: { email: string; customerId: string | null; dni: string }
}

/** EB-C03: her own purchase earns nothing. */
export function isSelfPurchase({ ambassador, order }: SelfCheck): boolean {
  if (ambassador.email.trim().toLowerCase() === order.email.trim().toLowerCase()) return true
  if (ambassador.customerId && ambassador.customerId === order.customerId) return true
  const cuit = ambassador.cuit?.replace(/\D/g, '')
  if (cuit && cuit.length === 11 && Number(cuit.slice(2, 10)) === Number(order.dni)) return true
  return false
}

/** The cookie written by her link: "CODE.timestamp". */
export const REF_COOKIE = 'lr_ref'
export const encodeRef = (code: string, at: Date) => `${code}.${at.getTime()}`
export function decodeRef(value: string | null | undefined): { code: string; at: Date } | null {
  const m = /^([A-Z0-9-]{3,30})\.(\d{10,14})$/.exec(value ?? '')
  return m ? { code: m[1]!, at: new Date(Number(m[2])) } : null
}

export type CommissionLine = { orderItemId: string; totalCents: number; vatPct: number; ratePct: number }

/**
 * EB-C02: per line, what the customer paid for it after discounts (shipping
 * is never in a line), without VAT when so configured; the rate of the line
 * (product, else ambassador, else general), frozen here.
 */
export function commissionFor(lines: CommissionLine[], withoutVat: boolean) {
  const out = lines.map((l) => {
    const base = withoutVat && l.vatPct > 0 ? Math.round(l.totalCents / (1 + l.vatPct / 100)) : l.totalCents
    return { orderItemId: l.orderItemId, baseCents: base, ratePct: l.ratePct, amountCents: Math.round((base * l.ratePct) / 100) }
  })
  return { lines: out, baseCents: out.reduce((a, l) => a + l.baseCents, 0), amountCents: out.reduce((a, l) => a + l.amountCents, 0) }
}
