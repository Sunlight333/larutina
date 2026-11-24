import Link from 'next/link'
import type { OrderStatus, PaymentMethod, Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { ORDER_STATUSES, STATUS_LABELS } from '@/lib/commerce/order-status'
import { formatARS } from '@/lib/money'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { PageHeader, Stat, formatDateTime } from '@/components/admin/ui'
import { OrderStatusBadge, paymentLabel } from './status'

export const metadata = { title: 'Pedidos' }

const METHODS: Record<PaymentMethod, string> = { MERCADOPAGO: 'Mercado Pago', TRANSFER: 'Transferencia' }

// PED-01: every order, newest first, with what needs attention counted on top.
export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('orders.view')
  const sp = await searchParams
  const db = getDb()
  const status = ORDER_STATUSES.find((s) => s === param(sp, 'estado')) as OrderStatus | undefined
  const method = (['MERCADOPAGO', 'TRANSFER'] as PaymentMethod[]).find((m) => m === param(sp, 'pago'))
  const q = param(sp, 'q')?.trim()
  const review = param(sp, 'revisar') === 'comprobantes'
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { paymentMethod: method } : {}),
    ...(review ? { status: 'PENDING_PAYMENT', payments: { some: { status: 'receipt_uploaded' } } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { dni: { contains: q } },
          ],
        }
      : {}),
  }
  const { skip, take, page, size } = pageOf(sp, 30)
  const [rows, total, receipts, toPrepare, toShip] = await Promise.all([
    db.order.findMany({ where, orderBy: { placedAt: 'desc' }, skip, take, include: { payments: { orderBy: { updatedAt: 'desc' }, take: 1 }, items: { select: { quantity: true } } } }),
    db.order.count({ where }),
    db.order.count({ where: { status: 'PENDING_PAYMENT', payments: { some: { status: 'receipt_uploaded' } } } }),
    db.order.count({ where: { status: 'PAID' } }),
    db.order.count({ where: { status: 'PREPARING' } }),
  ])
  return (
    <>
      <PageHeader title="Pedidos" description="Cada pedido con su pago, su envío y todo lo que le pasó." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Comprobantes para revisar" value={receipts} href="/pedidos?revisar=comprobantes" />
        <Stat label="Pagados, para preparar" value={toPrepare} href="/pedidos?estado=PAID" />
        <Stat label="En preparación, para despachar" value={toShip} href="/pedidos?estado=PREPARING" />
      </div>
      <FilterBar
        sp={sp}
        placeholder="Buscar por número, email, nombre o DNI"
        selects={[
          { name: 'estado', label: 'Estado', options: ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })) },
          { name: 'pago', label: 'Medio de pago', options: Object.entries(METHODS).map(([value, label]) => ({ value, label })) },
        ]}
      />
      <DataTable
        rows={rows}
        rowKey={(o) => o.id}
        empty="No hay pedidos."
        columns={[
          {
            key: 'number',
            label: 'Pedido',
            render: (o) => (
              <Link href={`/pedidos/${o.id}`} className="font-medium underline-offset-2 hover:underline">
                #{o.number}
                <span className="block text-xs font-normal text-ink-muted">{formatDateTime(o.placedAt)}</span>
              </Link>
            ),
          },
          {
            key: 'who',
            label: 'Clienta',
            render: (o) =>
              o.anonymizedAt ? (
                <span className="text-ink-muted">Cuenta eliminada</span>
              ) : (
                <>
                  {o.firstName} {o.lastName}
                  <span className="block text-xs text-ink-muted">{o.email}</span>
                </>
              ),
          },
          { key: 'items', label: 'Productos', render: (o) => o.items.reduce((n, i) => n + i.quantity, 0) },
          { key: 'total', label: 'Total', render: (o) => <span className="tabular">{formatARS(o.totalCents)}</span> },
          {
            key: 'payment',
            label: 'Pago',
            render: (o) => (
              <>
                {METHODS[o.paymentMethod]}
                <span className="block text-xs text-ink-muted">{paymentLabel(o.payments[0]?.status)}</span>
              </>
            ),
          },
          { key: 'status', label: 'Estado', render: (o) => <OrderStatusBadge status={o.status} /> },
        ]}
      />
      <Pagination basePath="/pedidos" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
