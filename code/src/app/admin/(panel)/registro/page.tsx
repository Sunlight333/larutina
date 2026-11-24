import type { Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { PageHeader, formatDateTime } from '@/components/admin/ui'

export const metadata = { title: 'Registro de cambios' }

// ADM-03: every change to catalog, prices, rules, content, settings and
// access, with user, date and before/after.
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('audit.view')
  const sp = await searchParams
  const db = getDb()
  const q = param(sp, 'q')
  const type = param(sp, 'tipo')
  const where: Prisma.AuditLogWhereInput = {
    ...(type ? { entityType: type } : {}),
    ...(q ? { OR: [{ label: { contains: q, mode: 'insensitive' } }, { actorEmail: { contains: q, mode: 'insensitive' } }, { action: { contains: q, mode: 'insensitive' } }] } : {}),
  }
  const { page, skip, take, size } = pageOf(sp)
  const [rows, total, types] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ['entityType'], orderBy: { entityType: 'asc' } }),
  ])
  return (
    <>
      <PageHeader title="Registro de cambios" description="Quién cambió qué y cuándo. No se puede editar ni borrar." />
      <FilterBar sp={sp} placeholder="Buscar por usuario, acción o elemento" selects={[{ name: 'tipo', label: 'Tipo', options: types.map((t) => ({ value: t.entityType, label: t.entityType })) }]} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="Todavía no hay cambios registrados."
        columns={[
          { key: 'at', label: 'Fecha', render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
          { key: 'actor', label: 'Usuario', render: (r) => r.actorEmail ?? 'Sistema' },
          { key: 'action', label: 'Acción', render: (r) => <code className="text-xs">{r.action}</code> },
          { key: 'entity', label: 'Elemento', render: (r) => <>{r.entityType}{r.label ? <span className="text-ink-muted"> · {r.label}</span> : null}</> },
          {
            key: 'detail',
            label: 'Detalle',
            render: (r) =>
              r.before || r.after ? (
                <details>
                  <summary className="cursor-pointer text-xs underline">Ver</summary>
                  <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-shell p-2 text-[0.6875rem] leading-snug">
                    {JSON.stringify({ antes: r.before, despues: r.after }, null, 1)}
                  </pre>
                </details>
              ) : null,
          },
        ]}
      />
      <Pagination basePath="/registro" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
