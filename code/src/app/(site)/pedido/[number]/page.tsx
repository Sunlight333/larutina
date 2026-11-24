import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight, Check, Clock, FaceScan, IconBadge, Sparkle } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { Bank, Box, Pin, Truck, User } from '@/components/checkout/icons'
import { leafPanel, Totals } from '@/components/checkout/ui'
import { CopyAlias, CreateAccount, ReceiptUpload } from '@/components/orders/order-forms'
import { PROVINCES, isProvince } from '@/lib/argentina'
import { isPaid, STATUS_LABELS } from '@/lib/commerce/order-status'
import { formatARS } from '@/lib/money'
import { whatsappLink } from '@/lib/whatsapp'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { sign } from '@/server/secret'
import { getSettings } from '@/server/settings'
import { WITHDRAWAL_DAYS } from '@/server/commerce/aftersale'
import { orderForRequest } from '@/server/commerce/order-access'
import { bankDetails, dayLabel, hourLabel } from '@/server/commerce/orders'
import { RECEIPT_ACCEPT } from '@/server/commerce/receipts'
import { currentCustomer } from '@/server/customers/session'
import { createAccountFromOrder, uploadReceipt } from './actions'

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string | string[] }> }

const tokenOf = (t: string | string[] | undefined) => (Array.isArray(t) ? t[0] : t) ?? null

// CK-18 (SEO): "Pedido confirmado · Larutina Beauty"; any other state reads as CU-20's "Seguí tu pedido".
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const order = await orderForRequest((await params).number, tokenOf((await searchParams).t))
  return { title: order && isPaid(order.status) ? 'Pedido confirmado' : 'Seguí tu pedido', robots: { index: false, follow: false } }
}

type Address = { street: string; unit: string | null; postcode: string; locality: string; province: string; notes: string | null }
type Shipping = { carrier?: string; service?: string; minDays?: number; maxDays?: number; priceCents?: number; free?: boolean }

// The order page (PED-05): the confirmation right after buying (CF-01 to
// CF-05, CK-17 for a pending payment) and, afterwards, the order's state,
// items, totals, shipping and tracking (CU-12). Opened by the signed link,
// by number and email (CU-20) or from the account it belongs to.
export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params
  const order = await orderForRequest(number, tokenOf((await searchParams).t))
  if (!order) redirect(`/seguir-mi-pedido?pedido=${encodeURIComponent(number)}`)

  const db = getDb()
  const s = await getSettings()
  const customer = await currentCustomer()
  const token = sign('order', order.id)
  const images = await resolveImages(db, order.items.map((i) => i.image ?? '').filter(Boolean))
  const transferPayment = order.payments.find((p) => p.provider === 'transfer')
  const cardPayment = order.payments.find((p) => p.provider !== 'transfer' && p.externalId)

  const awaitingTransfer = order.paymentMethod === 'TRANSFER' && order.status === 'PENDING_PAYMENT'
  const receiptIn = transferPayment?.status === 'receipt_uploaded'
  const pendingCard = order.paymentMethod === 'MERCADOPAGO' && order.status === 'PENDING_PAYMENT' && !!cardPayment && ['pending', 'in_process', 'authorized'].includes(cardPayment.status)
  const confirmed = order.status === 'PAID'
  const fresh = confirmed || awaitingTransfer || pendingCard

  // CF-04: a guest, with no account for this email yet.
  const hasAccount = !!customer || !!order.customerId || !!(await db.customer.findFirst({ where: { email: order.email, passwordHash: { not: null } }, select: { id: true } }))
  // CF-05: unless she bought from her diagnosis.
  const fromDiagnosis = order.items.some((i) => i.source === 'DIAGNOSIS')

  const address = order.shippingAddress as Address
  const shipping = order.shipping as Shipping
  const province = isProvince(address.province) ? PROVINCES[address.province] : address.province
  const bank = bankDetails(s)
  const until = order.reservedUntil
  const untilLabel = until ? `${hourLabel(until)}${dayLabel(until) !== dayLabel(new Date()) ? ` del ${dayLabel(until)}` : ''}` : null
  const whatsapp = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  const deliveredAt = order.shipment?.deliveredAt ?? order.deliveredAt
  const withdrawalOpen = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status) && (!deliveredAt || Date.now() - deliveredAt.getTime() <= WITHDRAWAL_DAYS * 86_400_000)

  return (
    <>
      {/* The state, said first. */}
      <header className="tex-linen relative overflow-hidden bg-shell">
        <div className="container-page flex flex-col gap-6 pb-12 pt-10 sm:flex-row sm:items-center md:pb-16 md:pt-14">
          <IconBadge size="xl" tone={confirmed ? 'sage' : fresh ? 'paper' : 'paper'} className="animate-rise">
            {confirmed ? <Check /> : fresh ? <Clock /> : <Box />}
          </IconBadge>
          <div className="animate-rise min-w-0">
            {confirmed ? (
              <>
                {/* CF-01 */}
                <h1 className="max-w-3xl font-display text-display-md text-balance">
                  Gracias, {order.firstName}. Tu pedido <span className="whitespace-nowrap">#{order.number}</span> está confirmado.
                </h1>
                <p className="mt-3 text-lede text-ink-soft">Te mandamos el detalle a {order.email}.</p>
              </>
            ) : awaitingTransfer ? (
              <h1 className="max-w-3xl font-display text-display-md text-balance">Tu pedido <span className="whitespace-nowrap">#{order.number}</span> está reservado.</h1>
            ) : pendingCard ? (
              /* CK-17 */
              <h1 className="max-w-3xl font-display text-display-md text-balance">Tu pago quedó pendiente. Te avisamos por email apenas Mercado Pago lo confirme.</h1>
            ) : (
              <>
                <p className="eyebrow">Seguí tu pedido</p>
                <h1 className="mt-2 font-display text-display-md">Pedido #{order.number}</h1>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="container-page py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
          <div className="min-w-0 space-y-8">
            {awaitingTransfer && (
              /* CF-03 */
              <section className={`bg-paper p-6 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-8 ${leafPanel}`} aria-labelledby="cf-transfer">
                <div className="flex items-center gap-4">
                  <IconBadge size="md">
                    <Bank />
                  </IconBadge>
                  <h2 id="cf-transfer" className="font-display text-display-sm">
                    Transferí {formatARS(order.totalCents)} a:
                  </h2>
                </div>
                <dl className="mt-6 divide-y divide-line rounded-[1.25rem_2rem_1.25rem_2rem] bg-shell px-5">
                  {[
                    ['Titular', bank.holder],
                    ['CUIT', bank.cuit],
                    ['Banco', bank.bank],
                    ['CBU', bank.cbu],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3.5">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="break-all font-semibold tabular">{v}</dd>
                      </div>
                    ))}
                  {bank.alias && (
                    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                      <div>
                        <dt className="text-ink-muted">Alias</dt>
                        <dd className="mt-0.5 break-all text-lg font-bold">{bank.alias}</dd>
                      </div>
                      <CopyAlias alias={bank.alias} />
                    </div>
                  )}
                </dl>
                {untilLabel && (
                  <p className="mt-5 flex items-start gap-3 text-[1.0625rem] font-semibold">
                    <Clock size={22} className="mt-0.5 shrink-0 text-accent-ink" />
                    Tenés {s['commerce.transferReservationHours']} horas, hasta las {untilLabel}.
                  </p>
                )}
                <p className="mt-3 text-ink-soft">
                  Mandanos el comprobante respondiendo el email o por{' '}
                  {whatsapp ? (
                    <a href={whatsapp} target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-4">
                      WhatsApp
                    </a>
                  ) : (
                    'WhatsApp'
                  )}
                  .
                </p>
                <div className="mt-6">
                  {receiptIn ? (
                    <p role="status" className="flex items-center gap-3 rounded-[1.25rem_2rem_1.25rem_2rem] bg-sage-soft px-5 py-4 font-semibold text-sage-ink">
                      <Check size={20} />
                      Recibimos tu comprobante. Lo revisamos y te avisamos por email.
                    </p>
                  ) : (
                    <ReceiptUpload action={uploadReceipt} number={order.number} token={token} accept={RECEIPT_ACCEPT} />
                  )}
                </div>
              </section>
            )}

            {confirmed && (
              /* CF-02 */
              <section aria-label="Próximos pasos">
                <ol className="grid gap-4 sm:grid-cols-3">
                  {[
                    { icon: <Box />, text: 'Preparamos tu pedido.' },
                    { icon: <Truck />, text: 'Cuando sale, te mandamos el número de seguimiento.' },
                    { icon: <Sparkle />, text: 'Mientras tanto, mirá cómo usar cada producto en tu rutina.' },
                  ].map((step, i) => (
                    <li key={i} className={`relative bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line ${i === 1 ? 'shape-leaf-alt sm:translate-y-3' : leafPanel}`}>
                      <div className="flex items-center gap-3">
                        <IconBadge size="sm" tone={i === 0 ? 'ink' : 'accent'}>
                          {step.icon}
                        </IconBadge>
                        <span className="font-display text-[1.6rem] leading-none text-ink-muted">{i + 1}.</span>
                      </div>
                      <p className="mt-4 font-semibold leading-snug">{step.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {fresh && !hasAccount && (
              /* CF-04 */
              <section className={`bg-night-soft p-6 sm:p-8 ${leafPanel}`} aria-labelledby="cf-account">
                <div className="flex items-start gap-4">
                  <IconBadge size="md" tone="paper">
                    <User />
                  </IconBadge>
                  <h2 id="cf-account" className="pt-2 text-lg font-semibold leading-snug">
                    Creá tu cuenta con {order.email} y guardá tus pedidos y tu rutina.
                  </h2>
                </div>
                <CreateAccount action={createAccountFromOrder} number={order.number} token={token} />
              </section>
            )}

            {fresh && !fromDiagnosis && (
              /* CF-05 */
              <section className={`flex flex-col gap-5 bg-accent-soft p-6 sm:flex-row sm:items-center sm:p-8 ${leafPanel}`}>
                <IconBadge size="lg" tone="paper">
                  <FaceScan />
                </IconBadge>
                <p className="flex-1 text-lg leading-snug">¿Todavía no hiciste el diagnóstico? Ocho preguntas y te decimos en qué orden usar lo que compraste.</p>
                <ButtonLink href="/diagnostico" className="shrink-0">
                  Hacer mi diagnóstico
                </ButtonLink>
              </section>
            )}

            {!fresh && withdrawalOpen && (
              /* CU-14 */
              <p className="text-ink-soft">
                ¿Te arrepentiste de la compra? Tenés {WITHDRAWAL_DAYS} días corridos desde que la recibís.{' '}
                <Link href="/arrepentimiento" className="font-semibold text-ink underline underline-offset-4">
                  Botón de arrepentimiento
                </Link>
              </p>
            )}
          </div>

          {/* CU-12: the order at a glance, then its detail. */}
          <aside className="h-fit space-y-5 lg:sticky lg:top-28" aria-labelledby="pedido-detalle">
            <div className={`tex-linen bg-shell p-6 shadow-[var(--shadow-soft)] sm:p-7 ${leafPanel}`}>
              <h2 id="pedido-detalle" className="font-semibold leading-snug">
                Pedido #{order.number} · {dayLabel(order.placedAt)} · {formatARS(order.totalCents)}
              </h2>
              <p className={`mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold ${isPaid(order.status) ? 'bg-sage-soft text-sage-ink' : order.status === 'CANCELLED' ? 'bg-paper text-ink-muted' : 'bg-accent-soft text-accent-ink'}`}>
                <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                {STATUS_LABELS[order.status]}
              </p>
              <ul className="mt-5 space-y-3">
                {order.items.map((i) => {
                  const img = i.image ? images.get(i.image) : undefined
                  return (
                    <li key={i.id} className="flex items-center gap-3">
                      <span className="relative w-14 shrink-0">
                        <span className="shape-arch block overflow-hidden">
                          <ProductImage image={img ? { src: img.src, width: img.width, height: img.height } : null} alt="" step="OTHER" sizes="3.5rem" />
                        </span>
                        <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-paper tabular">{i.quantity}</span>
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-snug">
                        <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{i.brandName}</span>
                        <span className="font-medium">{i.productName}</span>
                        <span className="text-ink-muted"> · {i.sizeLabel}</span>
                      </span>
                      <span className="text-sm font-semibold tabular">{formatARS(i.subtotalCents)}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-5 border-t border-line pt-5">
                <Totals t={{ subtotalCents: order.subtotalCents, discountCents: order.discountCents, shippingCents: order.shippingCents, shippingFree: shipping.free, totalCents: order.totalCents }} />
              </div>
            </div>

            <div className={`space-y-4 bg-paper p-6 shadow-[var(--shadow-soft)] ring-1 ring-line ${leafPanel}`}>
              <div className="flex gap-3">
                <Truck size={22} className="mt-0.5 shrink-0 text-accent-ink" />
                <div className="text-[0.9375rem] leading-relaxed">
                  <p className="font-semibold">Envío a domicilio</p>
                  {shipping.carrier && (
                    <p className="text-ink-soft">
                      {shipping.carrier}
                      {shipping.minDays != null && shipping.maxDays != null && ` · llega en ${shipping.minDays === shipping.maxDays ? shipping.maxDays : `${shipping.minDays} a ${shipping.maxDays}`} ${shipping.maxDays === 1 ? 'día hábil' : 'días hábiles'}`}
                    </p>
                  )}
                  {order.shipment?.trackingCode && <p className="mt-1 font-semibold tabular">{order.shipment.trackingCode}</p>}
                  {order.shipment?.trackingUrl && (
                    <a href={order.shipment.trackingUrl} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 font-semibold underline underline-offset-4">
                      Seguir envío
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Pin size={22} className="mt-0.5 shrink-0 text-accent-ink" />
                <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">
                    {order.firstName} {order.lastName}
                  </span>
                  <br />
                  {address.street}
                  {address.unit && `, ${address.unit}`}
                  <br />
                  {address.postcode} {address.locality}, {province}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
