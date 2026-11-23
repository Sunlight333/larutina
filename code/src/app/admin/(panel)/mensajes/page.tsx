import Link from 'next/link'
import type { ContactStatus, Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { STATUS_LABELS } from '@/server/services/content/contact'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { PageHeader, formatDateTime } from '@/components/admin/ui'
import { MessageStatusBadge } from './status'

export const metadata = { title: 'Mensajes de contacto' }

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('messages.view')
  const sp = await searchParams
  const db = getDb()
  const status = (Object.keys(STATUS_LABELS) as ContactStatus[]).find((s) => s === param(sp, 'estado'))
  const q = param(sp, 'q')?.trim()
  const where: Prisma.ContactMessageWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { orderNumber: { contains: q, mode: 'insensitive' } }] } : {}),
  }
  const { skip, take, page, size } = pageOf(sp, 30)
  const [rows, total] = await Promise.all([db.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), db.contactMessage.count({ where })])
  return (
    <>
      <PageHeader title="Mensajes de contacto" description="Lo que llega desde el formulario de /contacto, con las fotos adjuntas." />
      <FilterBar sp={sp} placeholder="Buscar por nombre, email o pedido" selects={[{ name: 'estado', label: 'Estado', options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) }]} />
      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty="No hay mensajes."
        columns={[
          { key: 'date', label: 'Recibido', render: (m) => formatDateTime(m.createdAt) },
          {
            key: 'who',
            label: 'De',
            render: (m) => (
              <Link href={`/admin/mensajes/${m.id}`} className="font-medium underline-offset-2 hover:underline">
                {m.name}
                <span className="block text-xs font-normal text-ink-muted">{m.email}</span>
              </Link>
            ),
          },
          { key: 'reason', label: 'Motivo', render: (m) => m.reason },
          { key: 'order', label: 'Pedido', render: (m) => m.orderNumber ?? '—' },
          { key: 'photos', label: 'Fotos', render: (m) => m.attachments.length || '—' },
          { key: 'status', label: 'Estado', render: (m) => <MessageStatusBadge status={m.status} /> },
        ]}
      />
      <Pagination basePath="/admin/mensajes" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
