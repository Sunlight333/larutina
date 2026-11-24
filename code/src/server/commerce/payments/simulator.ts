// A stand-in for Mercado Pago, for local work and tests, so the whole
// purchase can be walked without credentials. It never runs in production
// (paymentProvider() refuses it there). It behaves like Checkout Pro: the
// customer is sent to a page (/checkout/simulador) where she approves, leaves
// pending (cash voucher) or rejects; the page then "notifies" through the
// same path as Mercado Pago's webhook, and the payment is read back from here.
// Its payments live in payment_notifications under "simulator:state:<id>".
import { randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { CheckoutRequest, Notification, PaymentProvider, ProviderPayment } from './provider'

type Db = PrismaClient | Prisma.TransactionClient

const stateKey = (id: string) => `simulator:state:${id}`

export class SimulatorProvider implements PaymentProvider {
  readonly name = 'simulator' as const
  constructor(private readonly db: Db) {}

  async createCheckout(req: CheckoutRequest) {
    const preferenceId = `SIM-${req.orderNumber}-${req.expiresAt.getTime()}`
    return { preferenceId, redirectUrl: `/checkout/simulador?pref=${encodeURIComponent(preferenceId)}&order=${encodeURIComponent(req.orderId)}` }
  }

  /** What the simulator page does when the customer picks an outcome. */
  async simulate(orderId: string, amountCents: number, outcome: 'approved' | 'pending' | 'rejected', existingId?: string): Promise<ProviderPayment> {
    const id = existingId ?? `sim${randomBytes(6).toString('hex')}`
    const payment: ProviderPayment = {
      id,
      orderId,
      status: outcome,
      statusDetail: outcome === 'approved' ? 'accredited' : outcome === 'pending' ? 'pending_waiting_payment' : 'cc_rejected_other_reason',
      method: outcome === 'pending' ? 'ticket' : 'credit_card',
      installments: outcome === 'pending' ? 1 : 3,
      amountCents,
      raw: { simulated: true, outcome },
    }
    await this.db.paymentNotification.upsert({
      where: { dedupeKey: stateKey(id) },
      create: { provider: 'simulator', dedupeKey: stateKey(id), resourceId: id, payload: payment as unknown as Prisma.InputJsonValue, processedAt: new Date() },
      update: { payload: payment as unknown as Prisma.InputJsonValue },
    })
    return payment
  }

  async getPayment(id: string): Promise<ProviderPayment> {
    const row = await this.db.paymentNotification.findUnique({ where: { dedupeKey: stateKey(id) } })
    if (!row) throw new Error(`Simulated payment ${id} not found`)
    return row.payload as unknown as ProviderPayment
  }

  parseNotification({ body }: { url: URL; headers: Headers; body: unknown }): Notification {
    const b = body as { paymentId?: string; nonce?: string } | null
    if (!b?.paymentId) return { ok: false, reason: 'no payment id' }
    return { ok: true, paymentId: b.paymentId, dedupeKey: `simulator:payment:${b.paymentId}:${b.nonce ?? randomBytes(4).toString('hex')}` }
  }

  async refund(paymentId: string) {
    return { id: `simrefund-${paymentId}-${Date.now()}` }
  }
}
