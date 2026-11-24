// The shipping integration behind an interface owned by this codebase (02 §4,
// D-01): Zipnova by API, with Andreani as the alternative. Everything that
// quotes, ships or tracks goes through here, so the provider can change
// without touching the cart, the checkout or the panel.

export type QuoteRequest = {
  postcode: string
  province: string | null
  weightGrams: number
  box: { heightCm: number; widthCm: number; lengthCm: number } | null
  /** Declared value for insurance, in centavos. */
  valueCents: number
}

export type ShippingOption = {
  provider: string
  carrier: string // what the customer reads: the courier that carries the parcel (BO-08)
  service: string
  priceCents: number
  minDays: number
  maxDays: number
  /** The provider's id for this option, needed to create the shipment. */
  ref?: string
}

export type ShipmentRequest = {
  orderNumber: string
  option: ShippingOption
  recipient: { name: string; email: string; phone: string; dni: string; street: string; unit: string | null; postcode: string; locality: string; province: string; notes: string | null }
  weightGrams: number
  box: { code: string; heightCm: number; widthCm: number; lengthCm: number } | null
  valueCents: number
}

export type CreatedShipment = { externalId: string; trackingCode: string | null; trackingUrl: string | null; label: { data: Buffer; contentType: string } | null; costCents: number | null; raw: unknown }

export type TrackingState = { status: 'CREATED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED'; at: Date | null; raw: unknown }

export interface ShippingProvider {
  readonly name: string
  quote(req: QuoteRequest): Promise<ShippingOption[]>
  createShipment(req: ShipmentRequest): Promise<CreatedShipment>
  track(externalId: string): Promise<TrackingState>
}

export class ProviderUnavailableError extends Error {}

/**
 * Zipnova (D-01). Its API documentation and test credentials arrive with
 * LaRutina's account (due 04/12); until `ZIPNOVA_API_KEY` is set there is no
 * provider and every quote comes from the fallback rates (ENV-03), and
 * shipments are created by hand in the panel (ENV-05).
 */
export function shippingProvider(): ShippingProvider | null {
  if (!process.env.ZIPNOVA_API_KEY) return null
  // The adapter is written against Zipnova's documentation once it arrives.
  return null
}
