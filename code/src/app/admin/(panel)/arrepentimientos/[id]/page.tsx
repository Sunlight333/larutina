import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { WITHDRAWAL_STATUS } from '@/server/services/admin/commerce/settings'
import { AdminForm } from '@/components/admin/form'
import { Select, TextArea } from '@/components/admin/fields'
import { Card, DefinitionList, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { updateWithdrawalAction } from '../actions'

export const metadata = { title: 'Arrepentimiento' }

export default async function WithdrawalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('orders.view')
  const { id } = await params
  const w = await getDb().withdrawalRequest.findUnique({ where: { id }, include: { order: { select: { id: true, number: true, deliveredAt: true } } } })
  if (!w) notFound()
  return (
    <>
      <PageHeader title={w.code} back={{ href: '/arrepentimientos', label: 'Arrepentimientos' }} />
      {!w.order && (
        <div className="mb-6">
          <Notice tone="warning" title="No coincide con un pedido">
            El número o el contacto que escribió no coinciden con un pedido. Igual hay que responderle: buscá el pedido por otros datos.
          </Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <DefinitionList
            items={[
              ['Recibido', formatDateTime(w.createdAt)],
              ['Pedido', w.order ? <a key="o" href={`/pedidos/${w.order.id}`} className="underline underline-offset-2">#{w.order.number}</a> : w.orderNumber],
              ['Entregado', w.order?.deliveredAt ? formatDateTime(w.order.deliveredAt) : '—'],
              ['Nombre', w.name || '—'],
              ['Email', w.email ? <a key="e" href={`mailto:${w.email}?subject=${encodeURIComponent(`Tu arrepentimiento ${w.code}`)}`} className="underline underline-offset-2">{w.email}</a> : '—'],
              ['Teléfono', w.phone || '—'],
              ['Código enviado', w.emailSentAt ? formatDateTime(w.emailSentAt) : 'No (no dejó email: se lo mostramos en pantalla)'],
              ['Motivo', w.reason || 'Sin motivo (no hace falta dar uno)'],
            ]}
          />
        </Card>
        <Card title="Seguimiento">
          <AdminForm action={updateWithdrawalAction.bind(null, w.id)}>
            <Select name="status" label="Estado" defaultValue={w.status} options={Object.entries(WITHDRAWAL_STATUS).map(([value, label]) => ({ value, label }))} />
            <TextArea name="note" label="Nota interna" defaultValue={w.note} rows={4} />
          </AdminForm>
          <p className="mt-4 text-sm text-ink-muted">El reembolso se hace desde el pedido, cuando el producto vuelve.</p>
        </Card>
      </div>
    </>
  )
}
