import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Alert, Clock, IconBadge, Refresh } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { leafPanel } from '@/components/checkout/ui'
import { isPaid } from '@/lib/commerce/order-status'
import { getDb } from '@/server/db'
import { orderOfThisBrowser } from '@/server/commerce/order-access'
import { orderPath } from '@/server/commerce/orders'
import { paymentProvider, syncPayment } from '@/server/commerce/payments'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

// Back from Mercado Pago (its back_urls): approved → the confirmation;
// pending → CK-17; rejected or abandoned → CK-16 with "Reintentar". The page
// never trusts the query: the payment it names is read from the provider
// (CMP-04), and the order's state decides.
export default async function PaymentResultPage({ searchParams }: Props) {
  if (!(await canSeeCatalog())) notFound()
  const q = await searchParams
  const number = one(q.pedido)
  const db = getDb()
  let order = await orderOfThisBrowser(number)
  // Opened in another browser (the Mercado Pago app, say): the number and the email find it.
  if (!order) redirect(`/seguir-mi-pedido?pedido=${encodeURIComponent(number)}`)

  const paymentId = one(q.payment_id) || one(q.collection_id)
  const provider = paymentProvider(db)
  if (provider && /^[A-Za-z0-9_-]{1,64}$/.test(paymentId) && order.status === 'PENDING_PAYMENT') {
    // The webhook may not have arrived yet: read the payment now (safe to repeat).
    try {
      await syncPayment(db, provider, paymentId)
      order = (await orderOfThisBrowser(number))!
    } catch (e) {
      console.error(`[checkout] order ${order.number}: could not read payment ${paymentId}:`, (e as Error).message)
    }
  }

  if (isPaid(order.status) || order.paymentMethod === 'TRANSFER') redirect(orderPath(order))

  const last = order.payments.find((p) => p.provider !== 'transfer' && p.externalId)
  const pending = order.status === 'PENDING_PAYMENT' && !!last && ['pending', 'in_process', 'authorized'].includes(last.status)

  return (
    <div className="container-page py-12 md:py-20">
      <div className={`tex-linen mx-auto max-w-2xl bg-shell px-6 py-12 text-center shadow-[var(--shadow-soft)] sm:px-12 sm:py-16 ${leafPanel}`}>
        {pending ? (
          <>
            <IconBadge size="xl" tone="paper" className="mx-auto">
              <Clock />
            </IconBadge>
            {/* CK-17 */}
            <h1 className="mt-6 font-display text-display-sm text-balance">Tu pago quedó pendiente. Te avisamos por email apenas Mercado Pago lo confirme.</h1>
            <div className="mt-8 flex justify-center">
              <ButtonLink href={orderPath(order)} size="lg">
                Ver detalle
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <IconBadge size="xl" tone="accent" className="mx-auto">
              <Alert />
            </IconBadge>
            {/* CK-16 */}
            <h1 className="mt-6 font-display text-display-sm text-balance">El pago no se aprobó y no se te cobró nada.</h1>
            <p className="mt-3 text-lede text-ink-soft">Probá con otra tarjeta u otro medio de pago.</p>
            <div className="mt-8 flex justify-center">
              <ButtonLink href="/checkout" size="lg">
                <Refresh size={20} />
                Reintentar
              </ButtonLink>
            </div>
          </>
        )}
        <p className="mt-8 text-sm text-ink-muted">Pedido #{order.number}</p>
      </div>
    </div>
  )
}
