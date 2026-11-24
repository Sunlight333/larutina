import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { WITHDRAWAL_STATUS } from '@/server/services/admin/commerce/settings'
import { DataTable, Pagination, pageOf, type SearchParams } from '@/components/admin/table'
import { Badge, PageHeader, formatDateTime } from '@/components/admin/ui'

export const metadata = { title: 'Arrepentimientos' }

// PED-04: every request from the withdrawal button, matched to its order when possible.
export default async function WithdrawalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('orders.view')
  const sp = await searchParams
  const db = getDb()
  const { skip, take, page, size } = pageOf(sp, 30)
  const [rows, total] = await Promise.all([db.withdrawalRequest.findMany({ orderBy: { createdAt: 'desc' }, skip, take }), db.withdrawalRequest.count()])
  return (
    <>
      <PageHeader title="Arrepentimientos" description="Pedidos del botón de arrepentimiento. La clienta recibió su código por email; hay que escribirle para coordinar el retiro, sin costo para ella." />
      <DataTable
        rows={rows}
        rowKey={(w) => w.id}
        empty="Todavía no hay pedidos de arrepentimiento."
        columns={[
          {
            key: 'code',
            label: 'Código',
            render: (w) => (
              <Link href={`/arrepentimientos/${w.id}`} className="font-medium underline-offset-2 hover:underline">
                {w.code}
                <span className="block text-xs font-normal text-ink-muted">{formatDateTime(w.createdAt)}</span>
              </Link>
            ),
          },
          { key: 'order', label: 'Pedido', render: (w) => (w.orderId ? <Link href={`/pedidos/${w.orderId}`} className="underline underline-offset-2">#{w.orderNumber}</Link> : <>{w.orderNumber} <Badge tone="warning">sin coincidencia</Badge></>) },
          { key: 'who', label: 'Contacto', render: (w) => [w.name, w.email, w.phone].filter(Boolean).join(' · ') || '—' },
          { key: 'status', label: 'Estado', render: (w) => <Badge tone={w.status === 'closed' ? 'success' : w.status === 'received' ? 'warning' : 'info'}>{WITHDRAWAL_STATUS[w.status as keyof typeof WITHDRAWAL_STATUS] ?? w.status}</Badge> },
        ]}
      />
      <Pagination basePath="/arrepentimientos" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
