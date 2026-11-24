import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { adjustStockAction } from './actions'

export const metadata = { title: 'Stock y avisos' }

const TYPE = { RESERVATION: 'Reserva de un pedido', RELEASE: 'Liberado (pedido sin pagar)', RETURN: 'Devuelto (reembolso)', ADJUSTMENT: 'Ajuste' } as const

// The stock ledger (PED-02) and the back-in-stock list (NAV-07). Prices and
// stock in bulk stay in "Exportar y actualizar en lote"; this is for the
// day-to-day: a delivery, a count, a broken unit.
export default async function StockPage() {
  await requireAdmin('stock.adjust')
  const db = getDb()
  const [movements, waiting] = await Promise.all([
    db.inventoryMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 60, include: { variant: { select: { sku: true, product: { select: { name: true } } } } } }),
    db.backInStockRequest.groupBy({ by: ['variantId'], where: { notifiedAt: null }, _count: { _all: true } }),
  ])
  const variants = await db.productVariant.findMany({ where: { id: { in: waiting.map((w) => w.variantId) } }, select: { id: true, sku: true, stock: true, product: { select: { name: true } } } })
  const waitingRows = waiting.map((w) => ({ ...w, variant: variants.find((v) => v.id === w.variantId)! })).sort((a, b) => b._count._all - a._count._all)
  return (
    <>
      <PageHeader title="Stock y avisos" description="Ajustes del día a día y el registro de cada movimiento. Los avisos de 'volvió el stock' salen solos cuando el stock pasa de 0 a más." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <Card title="Ajustar stock">
            <AdminForm action={adjustStockAction} submitLabel="Ajustar" resetOnSuccess>
              <TextField name="sku" label="SKU" required />
              <TextField name="delta" label="Cuánto sumar o restar" type="number" required help="12 suma doce; -2 resta dos. Nunca queda negativo." />
              <TextField name="note" label="Motivo" required help="Llegó mercadería, conteo, rotura…" />
            </AdminForm>
          </Card>
          <Card title="Esperando que vuelva">
            {waitingRows.length ? (
              <ul className="space-y-2 text-sm">
                {waitingRows.map((w) => (
                  <li key={w.variantId}>
                    <strong>{w._count._all}</strong> · {w.variant.product.name} <span className="text-ink-muted">({w.variant.sku}, stock {w.variant.stock})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nadie espera un producto agotado.</p>
            )}
          </Card>
        </div>
        <Card title="Movimientos">
          <DataTable
            rows={movements}
            rowKey={(m) => m.id}
            empty="Todavía no hay movimientos."
            columns={[
              { key: 'd', label: 'Cuándo', render: (m) => formatDateTime(m.createdAt) },
              { key: 'p', label: 'Producto', render: (m) => <>{m.variant.product.name}<span className="block text-xs text-ink-muted">{m.variant.sku}</span></> },
              { key: 't', label: 'Movimiento', render: (m) => <>{TYPE[m.type]}{m.note ? <span className="block text-xs text-ink-muted">{m.note}</span> : null}</> },
              { key: 'q', label: 'Cant.', render: (m) => <span className="tabular">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span> },
              { key: 's', label: 'Queda', render: (m) => <span className="tabular">{m.stockAfter}</span> },
              { key: 'a', label: 'Quién', render: (m) => m.actor ?? '—' },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
