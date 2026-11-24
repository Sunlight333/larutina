import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { periodOf } from '@/server/ambassadors/commissions'
import { getSettings } from '@/server/settings'
import { formatARS } from '@/lib/money'
import { AdminForm } from '@/components/admin/form'
import { Select, TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { payoutPaidAction, settleAction } from '../actions'

export const metadata = { title: 'Liquidaciones' }

const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)))
}

// EMB-05, EB-C05: close a month, pay each settlement by transfer against her invoice.
export default async function PayoutsPage() {
  await requireAdmin('ambassadors.manage')
  const db = getDb()
  const s = await getSettings()
  const payouts = await db.commissionPayout.findMany({ orderBy: [{ period: 'desc' }, { createdAt: 'desc' }], take: 100, include: { ambassador: { select: { firstName: true, lastName: true, payoutAccount: true, cuit: true } }, _count: { select: { commissions: true } } } })
  const now = new Date()
  const periods = Array.from({ length: 6 }, (_, i) => periodOf(new Date(now.getFullYear(), now.getMonth() - 1 - i, 15)))
  return (
    <>
      <PageHeader title="Liquidaciones" description={`Cierre mensual con las comisiones aprobadas. Mínimo: ${s['ambassadors.minimumPayoutCents'] ? formatARS(s['ambassadors.minimumPayoutCents']) : 'sin mínimo (pendiente)'}; lo que no llega se suma al mes siguiente.`} back={{ href: '/embajadoras', label: 'Embajadoras' }} />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card title="Cerrar un mes">
          <AdminForm action={settleAction} submitLabel="Cerrar el mes">
            <Select name="period" label="Mes" options={periods.map((p) => ({ value: p, label: monthLabel(p) }))} />
            <p className="text-sm text-ink-muted">Cada embajadora que llega al mínimo recibe el email con el monto para facturar (EM-18).</p>
          </AdminForm>
        </Card>
        <Card title="Liquidaciones">
          <DataTable
            rows={payouts}
            rowKey={(p) => p.id}
            empty="Todavía no se cerró ningún mes."
            columns={[
              { key: 'm', label: 'Mes', render: (p) => monthLabel(p.period) },
              { key: 'a', label: 'Embajadora', render: (p) => <>{p.ambassador.firstName} {p.ambassador.lastName}<span className="block text-xs text-ink-muted">{p.ambassador.payoutAccount ?? 'Sin cuenta cargada'}</span></> },
              { key: 'v', label: 'Monto', render: (p) => <span className="tabular">{formatARS(p.amountCents)}<span className="block text-xs text-ink-muted">{p._count.commissions} compras</span></span> },
              {
                key: 's',
                label: 'Pago',
                render: (p) =>
                  p.paidAt ? (
                    <span className="text-sm">Pagada {formatDateTime(p.paidAt)}<span className="block text-xs text-ink-muted">Factura {p.invoiceNumber}</span></span>
                  ) : (
                    <AdminForm action={payoutPaidAction.bind(null, p.id)} submitLabel="Marcar pagada" className="flex items-end gap-2">
                      <TextField name="invoice" label="N° de factura" />
                    </AdminForm>
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
