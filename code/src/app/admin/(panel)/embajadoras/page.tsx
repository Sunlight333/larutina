import Link from 'next/link'
import type { AmbassadorStatus } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { formatARS } from '@/lib/money'
import { DataTable, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { AdminLink, Badge, PageHeader, formatDate } from '@/components/admin/ui'
import { AMB_STATUS } from './status'

export const metadata = { title: 'Embajadoras' }


// EMB-01: applications arrive with their attachments; an ambassador is active only once approved.
export default async function AmbassadorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('ambassadors.manage')
  const sp = await searchParams
  const status = (Object.keys(AMB_STATUS) as AmbassadorStatus[]).find((s) => s === param(sp, 'estado'))
  const db = getDb()
  const { skip, take, page, size } = pageOf(sp, 30)
  const where = status ? { status } : {}
  const [rows, total, sums] = await Promise.all([
    db.ambassador.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip, take, include: { _count: { select: { attributions: true } } } }),
    db.ambassador.count({ where }),
    db.commission.groupBy({ by: ['ambassadorId'], where: { status: { in: ['PENDING', 'APPROVED'] } }, _sum: { amountCents: true } }),
  ])
  const owed = new Map(sums.map((s) => [s.ambassadorId, s._sum.amountCents ?? 0]))
  return (
    <>
      <PageHeader
        title="Embajadoras"
        description="Profesionales que recomiendan con criterio (EB-00). Postulaciones, códigos, ventas y comisiones."
        actions={
          <>
            <AdminLink href="/embajadoras/liquidaciones">Liquidaciones</AdminLink>
            <AdminLink href="/embajadoras/material">Material</AdminLink>
          </>
        }
      />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Estado">
        <a href="/embajadoras" aria-current={!status ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm ${!status ? 'bg-ink text-paper' : 'bg-shell hover:bg-line'}`}>Todas</a>
        {(Object.keys(AMB_STATUS) as AmbassadorStatus[]).map((s) => (
          <a key={s} href={`/embajadoras?estado=${s}`} aria-current={s === status ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm ${s === status ? 'bg-ink text-paper' : 'bg-shell hover:bg-line'}`}>
            {AMB_STATUS[s].label}
          </a>
        ))}
      </nav>
      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        empty="Todavía no hay postulaciones."
        columns={[
          { key: 'n', label: 'Nombre', render: (a) => <Link href={`/embajadoras/${a.id}`} className="font-medium underline-offset-2 hover:underline">{a.firstName} {a.lastName}<span className="block text-xs font-normal text-ink-muted">{a.profession} · {a.city}</span></Link> },
          { key: 'c', label: 'Código', render: (a) => a.code ?? '—' },
          { key: 'v', label: 'Ventas', render: (a) => a._count.attributions },
          { key: 'o', label: 'Comisión a pagar', render: (a) => <span className="tabular">{formatARS(owed.get(a.id) ?? 0)}</span> },
          { key: 'd', label: 'Desde', render: (a) => formatDate(a.approvedAt ?? a.createdAt) },
          { key: 's', label: 'Estado', render: (a) => <Badge tone={AMB_STATUS[a.status].tone}>{AMB_STATUS[a.status].label}</Badge> },
        ]}
      />
      <Pagination basePath="/embajadoras" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
