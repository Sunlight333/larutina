import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { PROVINCES, formatCuit, isProvince } from '@/lib/argentina'
import { canMove, STATUS_LABELS } from '@/lib/commerce/order-status'
import { formatARS } from '@/lib/money'
import { CANCEL_REASONS } from '@/server/email/templates'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Checkbox, Select, TextArea, TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Card, DefinitionList, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { cancelAction, noteAction, orderStatusAction, refundAction, rejectReceiptAction, trackingAction } from '../actions'
import { OrderStatusBadge, paymentLabel } from '../status'

export const metadata = { title: 'Pedido' }

type Address = { street: string; unit: string | null; postcode: string; locality: string; province: string; notes: string | null }
type Shipping = { provider?: string; carrier?: string; service?: string; minDays?: number; maxDays?: number; free?: boolean; fallback?: boolean; boxCode?: string | null; weightGrams?: number; originalPriceCents?: number }
type Terms = { code: string; version: number | null }[]

const ACTOR: Record<string, string> = { SYSTEM: 'Sistema', ADMIN: 'Equipo', CUSTOMER: 'Clienta', PROVIDER: 'Proveedor' }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin('orders.view')
  const { id } = await params
  const db = getDb()
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'desc' } },
      shipment: true,
      refunds: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'desc' } },
      withdrawals: true,
      redemption: true,
    },
  })
  if (!order) notFound()
  const emails = await db.emailMessage.findMany({ where: { relatedType: 'order', relatedId: order.id }, orderBy: { createdAt: 'desc' }, select: { id: true, subject: true, status: true, createdAt: true, sentAt: true } })

  const manage = can(admin.role, 'orders.manage')
  const refund = can(admin.role, 'orders.refund')
  const seeCost = can(admin.role, 'catalog.cost')
  const a = order.shippingAddress as Address
  const ship = order.shipping as Shipping
  const terms = order.termsAccepted as Terms
  const invoice = order.invoice as { cuit: string; businessName: string } | null
  const transfer = order.payments.find((p) => p.provider === 'transfer')
  const refunded = order.refunds.reduce((n, r) => n + r.amountCents, 0)
  const refundable = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status) && refunded < order.totalCents
  const costTotal = order.items.reduce((n, i) => n + (i.unitCostCents ?? 0) * i.quantity, 0)
  const allCosts = order.items.every((i) => i.unitCostCents != null)

  return (
    <>
      <PageHeader title={`Pedido #${order.number}`} description={<OrderStatusBadge status={order.status} />} back={{ href: '/pedidos', label: 'Pedidos' }} />

      {transfer?.status === 'receipt_uploaded' && order.status === 'PENDING_PAYMENT' && (
        <div className="mb-6">
          <Notice tone="warning" title="Hay un comprobante de transferencia para revisar">
            Abrilo, fijate que la plata esté en la cuenta y confirmalo. Mientras está en revisión, el pedido no vence.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Productos">
            <DataTable
              rows={order.items}
              rowKey={(i) => i.id}
              columns={[
                {
                  key: 'p',
                  label: 'Producto',
                  render: (i) => (
                    <>
                      <span className="font-medium">{i.productName}</span>
                      <span className="block text-xs text-ink-muted">
                        {i.brandName} · {i.sizeLabel} · {i.sku}
                        {i.routineGroup ? ' · rutina' : ''}
                      </span>
                    </>
                  ),
                },
                { key: 'q', label: 'Cant.', render: (i) => (i.refundedQuantity ? `${i.quantity} (${i.refundedQuantity} reemb.)` : i.quantity) },
                { key: 'u', label: 'Precio', render: (i) => <span className="tabular">{formatARS(i.unitChargedCents)}</span> },
                { key: 'd', label: 'Descuento', render: (i) => (i.discountCents ? <span className="tabular">−{formatARS(i.discountCents)}</span> : '—') },
                { key: 't', label: 'Total', render: (i) => <span className="tabular">{formatARS(i.totalCents)}</span> },
                ...(seeCost ? [{ key: 'c', label: 'Costo', render: (i: (typeof order.items)[number]) => (i.unitCostCents != null ? <span className="tabular">{formatARS(i.unitCostCents * i.quantity)}</span> : '—') }] : []),
              ]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <DefinitionList
                items={[
                  ['Subtotal', formatARS(order.subtotalCents)],
                  ...(order.routineDiscountCents ? ([['Descuento de rutina', `−${formatARS(order.routineDiscountCents)}`]] as [string, string][]) : []),
                  ...(order.codeDiscountCents ? ([[`Código ${order.couponCode ?? ''}`, `−${formatARS(order.codeDiscountCents)}`]] as [string, string][]) : []),
                  ...(order.transferDiscountCents ? ([['Descuento por transferencia', `−${formatARS(order.transferDiscountCents)}`]] as [string, string][]) : []),
                  ['Envío', order.shippingCents ? formatARS(order.shippingCents) : ship.free ? `Gratis (costaba ${formatARS(ship.originalPriceCents ?? 0)})` : 'Gratis'],
                  ['Total', <strong key="t">{formatARS(order.totalCents)}</strong>],
                  ...(refunded ? ([['Reembolsado', `−${formatARS(refunded)}`]] as [string, string][]) : []),
                  ...(seeCost && allCosts ? ([['Margen (sin envío)', formatARS(order.totalCents - order.shippingCents - costTotal - refunded)]] as [string, string][]) : []),
                  ...(order.couponCode && !order.codeDiscountCents ? ([['Código cargado', `${order.couponCode} (sin descuento: el de rutina era mayor)`]] as [string, string][]) : []),
                  ...(order.ambassadorCode ? ([['Código de embajadora', order.ambassadorCode]] as [string, string][]) : []),
                ]}
              />
            </div>
          </Card>

          <Card title="Clienta y entrega">
            {order.anonymizedAt ? (
              <p className="text-sm text-ink-muted">La clienta eliminó su cuenta el {formatDateTime(order.anonymizedAt)}. Quedan los datos que exige la ley para la factura.</p>
            ) : null}
            <DefinitionList
              items={[
                ['Nombre', `${order.firstName} ${order.lastName}`],
                ['DNI', order.dni],
                ['Email', order.anonymizedAt ? '—' : <a key="m" href={`mailto:${order.email}?subject=${encodeURIComponent(`Tu pedido #${order.number}`)}`} className="underline underline-offset-2">{order.email}</a>],
                ['Teléfono', order.phone || '—'],
                ['Dirección', a.street ? `${a.street}${a.unit ? `, ${a.unit}` : ''}` : '—'],
                ['Localidad', `${a.locality} (${a.postcode}), ${isProvince(a.province) ? PROVINCES[a.province] : a.province}`],
                ['Indicaciones', a.notes || '—'],
                ['Factura A', invoice ? `${invoice.businessName} · CUIT ${formatCuit(invoice.cuit)}` : 'No'],
                ['Newsletter', order.newsletterOptIn ? 'Sí' : 'No'],
                ['Aceptó', terms.map((t) => `${t.code} v${t.version ?? '—'}`).join(' · ')],
              ]}
            />
          </Card>

          <Card title="Historial" description="Todo lo que le pasó al pedido, con quién lo hizo.">
            <ol className="space-y-3">
              {order.events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3 text-sm">
                  <p>
                    {e.toStatus && e.type === 'status' ? <strong>{STATUS_LABELS[e.toStatus]}</strong> : null}
                    {e.toStatus && e.type === 'status' && e.message ? ' · ' : ''}
                    {e.message}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(e.createdAt)} · {e.actorLabel ?? ACTOR[e.actorType]}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Emails" description="Lo que le mandamos por este pedido.">
            {emails.length ? (
              <ul className="space-y-2 text-sm">
                {emails.map((m) => (
                  <li key={m.id}>
                    {m.subject} <span className="text-xs text-ink-muted">· {formatDateTime(m.sentAt ?? m.createdAt)} · {m.status === 'SENT' ? 'enviado' : m.status === 'QUEUED' ? 'en cola' : m.status === 'SKIPPED' ? 'sin proveedor de email' : 'falló'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Ninguno todavía.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {manage && (canMove(order.status, 'PREPARING') || canMove(order.status, 'SHIPPED') || canMove(order.status, 'DELIVERED') || (transfer && order.status === 'PENDING_PAYMENT') || (transfer && order.status === 'CANCELLED')) && (
            <Card title="Próximo paso">
              <AdminForm action={orderStatusAction.bind(null, order.id)} submitLabel={null} className="flex flex-wrap gap-2">
                {transfer && (order.status === 'PENDING_PAYMENT' || order.status === 'CANCELLED') && (
                  <SubmitButton name="do" value="confirm-transfer" confirm="¿Confirmás que la transferencia está acreditada en la cuenta?">
                    Confirmar transferencia
                  </SubmitButton>
                )}
                {order.status !== 'PARTIALLY_REFUNDED' && canMove(order.status, 'PREPARING') && (
                  <SubmitButton name="do" value="preparing">
                    Pasar a preparación
                  </SubmitButton>
                )}
                {canMove(order.status, 'SHIPPED') && order.status !== 'SHIPPED' && (
                  <SubmitButton name="do" value="dispatched" variant="secondary" confirm="Le mandamos el email de despacho con el seguimiento cargado. ¿Seguimos?">
                    Marcar despachado
                  </SubmitButton>
                )}
                {canMove(order.status, 'DELIVERED') && (order.status === 'SHIPPED' || order.status === 'PARTIALLY_REFUNDED') && (
                  <SubmitButton name="do" value="delivered" variant="secondary">
                    Marcar entregado
                  </SubmitButton>
                )}
              </AdminForm>
            </Card>
          )}

          <Card title="Pago">
            <DefinitionList
              items={[
                ['Medio', order.paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Mercado Pago'],
                ['Reserva hasta', order.reservedUntil ? formatDateTime(order.reservedUntil) : '—'],
                ['Pagado', order.paidAt ? formatDateTime(order.paidAt) : '—'],
              ]}
            />
            <ul className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
              {order.payments.map((p) => (
                <li key={p.id}>
                  <strong>{paymentLabel(p.status)}</strong> · {formatARS(p.amountCents)}
                  {p.method ? ` · ${p.method === 'ticket' ? 'efectivo' : p.method === 'credit_card' ? 'tarjeta de crédito' : p.method === 'debit_card' ? 'tarjeta de débito' : p.method}` : ''}
                  {p.installments && p.installments > 1 ? ` · ${p.installments} cuotas` : ''}
                  {p.externalId ? <span className="block text-xs text-ink-muted">Operación {p.externalId}</span> : null}
                  {p.receipt ? (
                    <a href={`/comprobantes/${order.id}`} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-medium underline underline-offset-2">
                      Ver comprobante
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {manage && transfer?.status === 'receipt_uploaded' && order.status === 'PENDING_PAYMENT' && (
              <div className="mt-4 border-t border-line pt-4">
                <AdminForm action={rejectReceiptAction.bind(null, order.id)} submitLabel="Rechazar comprobante">
                  <TextField name="note" label="Qué no coincide" help="Se renueva la reserva y le mandamos el recordatorio con la nueva hora." />
                </AdminForm>
              </div>
            )}
          </Card>

          <Card title="Envío">
            <DefinitionList
              items={[
                ['Elegido', `${ship.carrier ?? '—'}${ship.minDays ? ` · ${ship.minDays} a ${ship.maxDays} días hábiles` : ''}`],
                ['Cotización', ship.fallback ? 'Tabla de respaldo (el proveedor no respondió o no está conectado)' : (ship.provider ?? '—')],
                ['Caja', ship.boxCode ?? 'Sin cajas cargadas'],
                ['Peso', ship.weightGrams ? `${ship.weightGrams} g` : '—'],
                ['Estado', order.shipment ? { PENDING: 'Para crear', CREATED: 'Etiqueta lista', DISPATCHED: 'Despachado', DELIVERED: 'Entregado', FAILED: 'Error', CANCELLED: 'Cancelado' }[order.shipment.status] : '—'],
              ]}
            />
            {manage && order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
              <div className="mt-4 border-t border-line pt-4">
                <AdminForm action={trackingAction.bind(null, order.id)} submitLabel="Guardar seguimiento">
                  <TextField name="carrier" label="Correo" defaultValue={order.shipment?.carrier ?? ship.carrier} />
                  <TextField name="trackingCode" label="Número de seguimiento" defaultValue={order.shipment?.trackingCode} />
                  <TextField name="trackingUrl" label="Link de seguimiento" type="url" defaultValue={order.shipment?.trackingUrl} help="Lo que la API del proveedor no carga, se carga acá (ENV-05)." />
                </AdminForm>
              </div>
            )}
          </Card>

          {order.withdrawals.length > 0 && (
            <Card title="Arrepentimiento">
              <ul className="space-y-1 text-sm">
                {order.withdrawals.map((w) => (
                  <li key={w.id}>
                    <a href={`/arrepentimientos/${w.id}`} className="font-medium underline underline-offset-2">
                      {w.code}
                    </a>{' '}
                    · {formatDateTime(w.createdAt)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {refund && refundable && (
            <Card title="Reembolso" description={order.paymentMethod === 'MERCADOPAGO' ? 'Se devuelve por Mercado Pago, que lo acredita según sus plazos.' : 'Transferí el dinero a la clienta y registralo acá.'}>
              <AdminForm action={refundAction.bind(null, order.id)} submitLabel="Reembolsar">
                {order.items.map((i) =>
                  i.quantity > i.refundedQuantity ? (
                    <div key={i.id} className="rounded-lg border border-line p-3">
                      <TextField name={`qty:${i.id}`} label={`${i.productName} (quedan ${i.quantity - i.refundedQuantity})`} type="number" defaultValue={0} />
                      <div className="mt-2">
                        <Checkbox name={`restock:${i.id}`} label="Vuelve al stock" />
                      </div>
                    </div>
                  ) : null,
                )}
                {order.shippingCents > 0 && <Checkbox name="shipping" label={`Incluir el envío (${formatARS(order.shippingCents)})`} />}
                <TextField name="amount" label="Otro importe (opcional)" help={`Vacío: el valor de lo elegido, con su descuento. Disponible: ${formatARS(order.totalCents - refunded)}.`} />
                <TextArea name="reason" label="Motivo" rows={2} required />
              </AdminForm>
            </Card>
          )}

          {manage && order.status === 'PENDING_PAYMENT' && (
            <Card title="Cancelar">
              <AdminForm action={cancelAction.bind(null, order.id)} submitLabel="Cancelar el pedido">
                <Select name="reason" label="Motivo (va en el email)" options={Object.entries(CANCEL_REASONS).map(([value, label]) => ({ value, label }))} allowEmpty="Elegí" />
                <TextField name="note" label="Nota interna (opcional)" />
              </AdminForm>
            </Card>
          )}

          <Card title="Nota interna">
            <AdminForm action={noteAction.bind(null, order.id)} submitLabel="Agregar nota" resetOnSuccess>
              <TextArea name="note" label="Nota" rows={3} help="Queda en el historial. La clienta no la ve." />
            </AdminForm>
          </Card>
        </div>
      </div>
    </>
  )
}
