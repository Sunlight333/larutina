'use server'

import { randomBytes } from 'node:crypto'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { paymentProvider, receiveNotification } from '@/server/commerce/payments'
import { SimulatorProvider } from '@/server/commerce/payments/simulator'

/** The simulator's choice: the payment is recorded, "notified" like a webhook, and she goes back to the result page. */
export async function simulatePayment(form: FormData) {
  const db = getDb()
  const provider = paymentProvider(db)
  if (!(provider instanceof SimulatorProvider)) notFound()
  const outcome = form.get('outcome')
  if (outcome !== 'approved' && outcome !== 'pending' && outcome !== 'rejected') notFound()
  const order = await db.order.findUnique({ where: { id: String(form.get('order') ?? '') }, include: { payments: true } })
  if (!order || !order.payments.some((p) => p.preferenceId === String(form.get('pref') ?? ''))) notFound()
  if (order.status === 'PENDING_PAYMENT') {
    const payment = await provider.simulate(order.id, order.totalCents, outcome)
    await receiveNotification(db, provider, { url: new URL('http://simulador.local/api/pagos/notificacion'), headers: new Headers(), body: { paymentId: payment.id, nonce: randomBytes(4).toString('hex') } })
  }
  redirect(`/checkout/resultado?pedido=${encodeURIComponent(order.number)}`)
}
