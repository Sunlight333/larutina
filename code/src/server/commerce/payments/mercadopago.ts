// Mercado Pago Checkout Pro (CMP-04). A preference is created per order and
// the customer pays on Mercado Pago. Notifications are only a signal: each one
// has its signature checked (x-signature, HMAC-SHA256 with the webhook
// secret), and then the payment is read again from Mercado Pago's API, which
// is what the order trusts. The whole order is one item, priced at the order
// total: Mercado Pago has no discount line, and this way what the customer
// pays there is exactly the total she accepted here.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CheckoutRequest, Notification, PaymentProvider, ProviderPayment } from './provider'

const API = 'https://api.mercadopago.com'

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago' as const
  constructor(
    private readonly accessToken: string,
    private readonly webhookSecret: string | null,
  ) {}

  private async call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    const body = (await res.json().catch(() => ({}))) as T & { message?: string }
    if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${body.message ?? 'error'}`)
    return body
  }

  async createCheckout(req: CheckoutRequest) {
    const pref = await this.call<{ id: string; init_point: string }>('/checkout/preferences', {
      method: 'POST',
      idempotencyKey: `pref-${req.orderId}-${req.expiresAt.getTime()}`,
      body: JSON.stringify({
        items: [{ id: req.orderNumber, title: req.title, quantity: 1, unit_price: req.totalCents / 100, currency_id: 'ARS' }],
        payer: { email: req.payer.email, name: req.payer.firstName, surname: req.payer.lastName, identification: { type: 'DNI', number: req.payer.dni } },
        external_reference: req.orderId,
        back_urls: req.urls,
        auto_return: 'approved',
        notification_url: req.urls.notification,
        statement_descriptor: 'LARUTINA',
        expires: true,
        expiration_date_to: req.expiresAt.toISOString(),
        // Cash vouchers per Q-01; the date limit keeps a voucher inside the reservation.
        payment_methods: { installments: Math.max(1, req.maxInstallments), excluded_payment_types: req.allowCash ? [] : [{ id: 'ticket' }] },
        date_of_expiration: req.expiresAt.toISOString(),
      }),
    })
    return { preferenceId: pref.id, redirectUrl: pref.init_point }
  }

  async getPayment(id: string): Promise<ProviderPayment> {
    const p = await this.call<{
      id: number
      status: string
      status_detail: string | null
      payment_type_id: string | null
      installments: number | null
      transaction_amount: number
      external_reference: string | null
    }>(`/v1/payments/${encodeURIComponent(id)}`)
    return {
      id: String(p.id),
      orderId: p.external_reference,
      status: p.status,
      statusDetail: p.status_detail,
      method: p.payment_type_id,
      installments: p.installments,
      amountCents: Math.round(p.transaction_amount * 100),
      raw: p,
    }
  }

  /**
   * Webhooks carry `type=payment` (or topic=payment) and the payment id in
   * `data.id`. The signature header is "ts=…,v1=…" over
   * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
   */
  parseNotification({ url, headers, body }: { url: URL; headers: Headers; body: unknown }): Notification {
    const b = (body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } }
    const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? b.type
    const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? (b.data?.id != null ? String(b.data.id) : null)
    if (type !== 'payment' || !dataId) return { ok: false, reason: 'not a payment notification' }
    if (!this.webhookSecret) return { ok: false, reason: 'MP_WEBHOOK_SECRET is not set' }
    const signature = headers.get('x-signature') ?? ''
    const requestId = headers.get('x-request-id') ?? ''
    const parts = Object.fromEntries(signature.split(',').map((p) => p.trim().split('=') as [string, string]))
    if (!parts.ts || !parts.v1) return { ok: false, reason: 'missing signature' }
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
    const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`
    const expected = Buffer.from(createHmac('sha256', this.webhookSecret).update(manifest).digest('hex'))
    const given = Buffer.from(parts.v1)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'bad signature' }
    return { ok: true, paymentId: dataId, dedupeKey: `mercadopago:payment:${dataId}:${requestId || parts.ts}` }
  }

  async refund(paymentId: string, amountCents: number | null, idempotencyKey: string) {
    const r = await this.call<{ id: number }>(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(amountCents == null ? {} : { amount: amountCents / 100 }),
    })
    return { id: String(r.id) }
  }
}
