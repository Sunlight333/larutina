import Link from 'next/link'
import type { OrderStatus } from '@prisma/client'
import { ArrowRight, ArrowUpRight, Package, Refresh, Sparkle, Truck } from '@/components/icons'
import { ButtonLink, buttonClasses } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { AccountHeading, EmptyState, longDate } from '@/components/account/ui'
import { Submit } from '@/components/account/fields'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { orderPath } from '@/server/commerce/orders'
import { customerOrders, hasReviewableLine, trackingTarget, withdrawalOpen } from '@/server/customers/history'
import { requireCustomer } from '@/server/customers/web'
import { STATUS_LABELS } from '@/lib/commerce/order-status'
import { formatARS } from '@/lib/money'
import { reorderAction } from '../../actions'

const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-accent-soft text-accent-ink',
  PAID: 'bg-night-soft text-night',
  PREPARING: 'bg-night-soft text-night',
  SHIPPED: 'bg-night-soft text-night',
  DELIVERED: 'bg-sage-soft text-sage-ink',
  PARTIALLY_REFUNDED: 'bg-shell text-ink-soft ring-1 ring-line',
  CANCELLED: 'bg-shell text-ink-muted ring-1 ring-line',
  REFUNDED: 'bg-shell text-ink-muted ring-1 ring-line',
}

// CU-12 to CU-14: her orders, newest first, with the same states as the
// emails; the withdrawal button on each order still inside its 10 days.
export default async function OrdersPage() {
  const customer = await requireCustomer('/cuenta/pedidos')
  const db = getDb()
  const orders = await customerOrders(db, customer.id)
  const images = await resolveImages(db, orders.flatMap((o) => o.items.map((i) => i.image ?? '')).filter(Boolean))
  const now = new Date()

  return (
    <>
      <AccountHeading icon={<Package size={28} />} title="Pedidos" />
      {orders.length === 0 ? (
        <EmptyState
          icon={<Package size={34} />}
          actions={
            <ButtonLink href="/productos" size="lg">
              Ver productos <ArrowRight size={18} />
            </ButtonLink>
          }
        >
          <p>Todavía no hiciste ningún pedido.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-5">
          {orders.map((o, i) => {
            const tracking = trackingTarget(o.shipment)
            const detail = orderPath(o)
            return (
              <li key={o.id} data-reveal="up" style={{ '--i': Math.min(i, 3) } as React.CSSProperties}>
                <article className={`bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-7 ${i % 2 ? 'rounded-[2.5rem_1.25rem_2.5rem_1.25rem]' : 'rounded-[1.25rem_2.5rem_1.25rem_2.5rem]'}`}>
                  <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <h2 className="font-display text-[1.3rem] leading-tight tabular">
                      Pedido #{o.number}
                      <span className="mt-1 block font-sans text-[0.9375rem] font-medium text-ink-muted sm:ml-2 sm:mt-0 sm:inline">
                        · {longDate(o.placedAt)} · {formatARS(o.totalCents)}
                      </span>
                    </h2>
                    <span className={`inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold ${TONE[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  </header>

                  <ul className="mt-5 flex flex-wrap gap-3" aria-label="Productos">
                    {o.items.map((item) => (
                      <li key={item.id} className="flex min-w-0 items-center gap-3 rounded-[1rem_1.75rem_1rem_1.75rem] bg-shell py-2 pl-2 pr-4">
                        <ProductImage image={item.image ? images.get(item.image) : null} alt="" step={item.variant?.product.routineStep ?? 'TREATMENT'} sizes="48px" className="w-12 shrink-0 rounded-[0.7rem]" />
                        <span className="min-w-0 text-[0.9375rem] leading-snug">
                          <span className="line-clamp-2">{item.productName}</span>
                          <span className="block text-sm text-ink-muted tabular">
                            {item.sizeLabel} · ×{item.quantity}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <ButtonLink href={detail} variant="secondary">
                      Ver detalle
                    </ButtonLink>
                    {tracking === 'url' && o.shipment?.trackingUrl && (
                      <a href={o.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary')}>
                        <Truck size={20} /> Seguir envío <ArrowUpRight size={16} />
                      </a>
                    )}
                    {tracking === 'order' && (
                      <ButtonLink href={detail} variant="secondary">
                        <Truck size={20} /> Seguir envío
                      </ButtonLink>
                    )}
                    <form action={reorderAction}>
                      <input type="hidden" name="number" value={o.number} />
                      <Submit variant="secondary" size="md">
                        <Refresh size={19} /> Volver a comprar
                      </Submit>
                    </form>
                    {hasReviewableLine(o) && (
                      <ButtonLink href={`/resenas/${o.number}`} variant="ghost">
                        <Sparkle size={19} /> Escribí tu reseña
                      </ButtonLink>
                    )}
                  </div>

                  {withdrawalOpen(o, now) && (
                    <div className="tex-linen mt-6 flex flex-col gap-3 rounded-[1.25rem_2rem_1.25rem_2rem] bg-shell p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">¿Te arrepentiste de la compra? Tenés 10 días corridos desde que la recibís.</p>
                      <Link href={`/arrepentimiento?pedido=${encodeURIComponent(o.number)}`} className={buttonClasses('primary', 'md', 'shrink-0')}>
                        Botón de arrepentimiento
                      </Link>
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
