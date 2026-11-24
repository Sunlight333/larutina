// What the browser receives about a cart. Built field by field, so the cost
// (CAT-20), the parcel measurements and internal ids never leave the server.
import type { CartView } from './cart'

export type PublicCartLine = {
  id: string
  sku: string
  productCode: string
  name: string
  brand: string
  sizeLabel: string
  stepLabel: string
  momentLabel: string
  unitPriceCents: number
  unitChargedCents: number
  quantity: number
  maxQty: number
  presale: string | null
  routineGroup: string | null
  lineTotalCents: number
  lineDiscountCents: number
  image: { src: string; width: number; height: number; alt: string } | null
}

export type PublicCart = {
  count: number
  lines: PublicCartLine[]
  notices: string[]
  couponCode: string | null
  couponError: string | null
  postcode: string | null
  subtotalCents: number
  routineDiscountCents: number
  codeDiscountCents: number
  discountCents: number
  totalCents: number
  codeOutdone: boolean
}

export function publicCart(view: CartView): PublicCart {
  const priced = new Map(view.pricing.lines.map((l) => [l.key, l]))
  return {
    count: view.count,
    lines: view.lines.map((l) => ({
      id: l.id,
      sku: l.sku,
      productCode: l.productCode,
      name: l.name,
      brand: l.brand,
      sizeLabel: l.sizeLabel,
      stepLabel: l.stepLabel,
      momentLabel: l.momentLabel,
      unitPriceCents: l.unitPriceCents,
      unitChargedCents: l.unitChargedCents,
      quantity: l.quantity,
      maxQty: l.maxQty,
      presale: l.presale,
      routineGroup: l.routineGroup,
      lineTotalCents: priced.get(l.id)?.totalCents ?? l.unitChargedCents * l.quantity,
      lineDiscountCents: priced.get(l.id)?.discountCents ?? 0,
      image: l.image,
    })),
    notices: view.notices,
    couponCode: view.couponCode,
    couponError: view.couponError,
    postcode: view.postcode,
    subtotalCents: view.pricing.subtotalCents,
    routineDiscountCents: view.pricing.routineDiscountCents,
    codeDiscountCents: view.pricing.codeDiscountCents,
    discountCents: view.pricing.discountCents,
    totalCents: view.pricing.totalCents,
    codeOutdone: view.pricing.codeOutdone,
  }
}
