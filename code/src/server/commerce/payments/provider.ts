// Payments behind an interface owned by this codebase (02 §4). The MVP
// provider is Mercado Pago Checkout Pro: the customer pays on Mercado Pago's
// pages, so card data never reach LaRutina's servers (CMP-07), and cuotas and
// promotions are Mercado Pago's (CK-07). Test and live credentials switch by
// configuration only (IR-33): MP_ACCESS_TOKEN decides which account answers.

export type CheckoutRequest = {
  orderId: string
  orderNumber: string
  title: string
  totalCents: number
  payer: { email: string; firstName: string; lastName: string; dni: string; phone: string }
  urls: { success: string; failure: string; pending: string; notification: string }
  expiresAt: Date
  maxInstallments: number
  allowCash: boolean
}

export type ProviderPayment = {
  id: string
  /** The order id we sent as external reference. */
  orderId: string | null
  status: string // approved | pending | in_process | rejected | cancelled | refunded | charged_back | authorized | in_mediation
  statusDetail: string | null
  method: string | null // credit_card, debit_card, ticket, account_money, bank_transfer
  installments: number | null
  amountCents: number
  raw: unknown
}

export type Notification = { ok: true; paymentId: string; dedupeKey: string } | { ok: false; reason: string }

export interface PaymentProvider {
  readonly name: 'mercadopago' | 'simulator'
  createCheckout(req: CheckoutRequest): Promise<{ preferenceId: string; redirectUrl: string }>
  /** The payment as the provider has it now: the only source the order trusts (CMP-04). */
  getPayment(id: string): Promise<ProviderPayment>
  /** Checks a notification's signature and returns the payment it is about. */
  parseNotification(req: { url: URL; headers: Headers; body: unknown }): Notification
  refund(paymentId: string, amountCents: number | null, idempotencyKey: string): Promise<{ id: string }>
}
