import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Alert, Check, Clock, Close } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { leafPanel } from '@/components/checkout/ui'
import { formatARS } from '@/lib/money'
import { getDb } from '@/server/db'
import { paymentProvider } from '@/server/commerce/payments'
import { SimulatorProvider } from '@/server/commerce/payments/simulator'
import { simulatePayment } from './actions'

export const metadata: Metadata = { title: 'Simulador de pagos', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

// A test page standing in for Mercado Pago (payments/simulator.ts): only when
// the simulator is the active provider (PAYMENTS_SIMULATOR=1, never in
// production). Each choice "notifies" through the same path as the webhook.
export default async function SimulatorPage({ searchParams }: Props) {
  const db = getDb()
  if (!(paymentProvider(db) instanceof SimulatorProvider)) notFound()
  const q = await searchParams
  const pref = one(q.pref)
  const order = await db.order.findUnique({ where: { id: one(q.order) }, include: { payments: true } })
  if (!order || !order.payments.some((p) => p.preferenceId === pref)) notFound()
  const open = order.status === 'PENDING_PAYMENT'

  const choices = [
    { outcome: 'approved', label: 'Aprobar con tarjeta', detail: 'Tarjeta de crédito en 3 cuotas: el pago se acredita.', icon: <Check size={22} />, tone: 'bg-sage-soft text-sage-ink' },
    { outcome: 'pending', label: 'Dejar pendiente', detail: 'Cupón de pago en efectivo (Pago Fácil, Rapipago): el pedido espera.', icon: <Clock size={22} />, tone: 'bg-accent-soft text-accent-ink' },
    { outcome: 'rejected', label: 'Rechazar', detail: 'La tarjeta no se aprueba.', icon: <Close size={22} />, tone: 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.15_25)]' },
  ] as const

  return (
    <div className="container-page py-10 md:py-16">
      <div className="mx-auto max-w-xl">
        <p className="flex items-center gap-3 rounded-full border-2 border-dashed border-accent bg-accent-soft px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-accent-ink">
          <Alert size={20} className="shrink-0" />
          Página de prueba · no es Mercado Pago y no se cobra nada
        </p>
        <div className={`mt-6 bg-paper p-6 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8 ${leafPanel}`}>
          <h1 className="font-display text-display-sm">Simulador de pagos</h1>
          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-shell p-5">
            <div>
              <dt className="text-sm text-ink-muted">Pedido</dt>
              <dd className="mt-1 font-semibold">#{order.number}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Total</dt>
              <dd className="mt-1 font-display text-[1.6rem] leading-none tabular">{formatARS(order.totalCents)}</dd>
            </div>
          </dl>
          {open ? (
            <div className="mt-6 space-y-3">
              {choices.map((c) => (
                <form key={c.outcome} action={simulatePayment}>
                  <input type="hidden" name="order" value={order.id} />
                  <input type="hidden" name="pref" value={pref} />
                  <input type="hidden" name="outcome" value={c.outcome} />
                  <button type="submit" className="flex w-full items-center gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] border-2 border-line p-4 text-left transition-colors hover:border-ink">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full ${c.tone}`}>{c.icon}</span>
                    <span>
                      <span className="block font-semibold">{c.label}</span>
                      <span className="block text-sm text-ink-soft">{c.detail}</span>
                    </span>
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-ink-soft">Este pedido ya no espera un pago.</p>
          )}
          <a href={`/checkout/resultado?pedido=${encodeURIComponent(order.number)}`} className={buttonClasses('ghost', 'sm', 'mt-6')}>
            Volver sin pagar
          </a>
        </div>
      </div>
    </div>
  )
}
