import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { formatARS } from '@/lib/money'
import { DataTable } from '@/components/admin/table'
import { AdminLink, Badge, PageHeader, formatDate } from '@/components/admin/ui'

export const metadata = { title: 'Cupones' }

export default async function CouponsPage() {
  await requireAdmin('commerce.settings')
  const db = getDb()
  const coupons = await db.coupon.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { redemptions: { where: { order: { status: { not: 'CANCELLED' } } } } } } } })
  const now = new Date()
  return (
    <>
      <PageHeader title="Cupones" description="Por porcentaje o monto, con vigencia, mínimo, usos y primera compra (CMP-08)." actions={<AdminLink href="/cupones/nuevo" variant="primary">Nuevo cupón</AdminLink>} />
      <DataTable
        rows={coupons}
        rowKey={(c) => c.id}
        empty="Todavía no hay cupones."
        columns={[
          {
            key: 'code',
            label: 'Código',
            render: (c) => (
              <Link href={`/cupones/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                {c.code}
                {c.description && <span className="block text-xs font-normal text-ink-muted">{c.description}</span>}
              </Link>
            ),
          },
          { key: 'value', label: 'Descuento', render: (c) => (c.kind === 'PERCENT' ? `${c.value}%` : formatARS(c.value)) },
          { key: 'when', label: 'Vigencia', render: (c) => (c.startsAt || c.endsAt ? `${c.startsAt ? formatDate(c.startsAt) : '…'} – ${c.endsAt ? formatDate(c.endsAt) : '…'}` : 'Siempre') },
          { key: 'uses', label: 'Usos', render: (c) => `${c._count.redemptions}${c.maxUses ? ` de ${c.maxUses}` : ''}` },
          {
            key: 'state',
            label: 'Estado',
            render: (c) =>
              !c.active ? <Badge>Inactivo</Badge> : c.endsAt && c.endsAt < now ? <Badge>Vencido</Badge> : c.startsAt && c.startsAt > now ? <Badge tone="info">Programado</Badge> : <Badge tone="success">Activo</Badge>,
          },
        ]}
      />
    </>
  )
}
