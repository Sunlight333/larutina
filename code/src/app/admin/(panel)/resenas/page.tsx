import type { ReviewStatus } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from '@/components/admin/ui'
import { moderateAction } from './actions'

export const metadata = { title: 'Reseñas' }

const TABS: { value: ReviewStatus; label: string }[] = [
  { value: 'PENDING', label: 'Para revisar' },
  { value: 'APPROVED', label: 'Publicadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
]

// PDP-07: only verified buyers write; nothing is published before it is read here.
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('reviews.moderate')
  const sp = await searchParams
  const status = TABS.find((t) => t.value === param(sp, 'estado'))?.value ?? 'PENDING'
  const db = getDb()
  const { skip, take, page, size } = pageOf(sp, 20)
  const [rows, total, pending] = await Promise.all([
    db.review.findMany({ where: { status }, orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' }, skip, take, include: { product: { select: { name: true, code: true } }, orderItem: { select: { order: { select: { number: true, id: true } } } } } }),
    db.review.count({ where: { status } }),
    db.review.count({ where: { status: 'PENDING' } }),
  ])
  return (
    <>
      <PageHeader title="Reseñas" description="Solo de compradoras verificadas. Se publican cuando las aprobás; la ficha muestra el bloque desde el mínimo de Configuración." />
      <nav className="mb-6 flex gap-2" aria-label="Estado">
        {TABS.map((t) => (
          <a key={t.value} href={`/resenas?estado=${t.value}`} aria-current={t.value === status ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm ${t.value === status ? 'bg-ink text-paper' : 'bg-shell hover:bg-line'}`}>
            {t.label}
            {t.value === 'PENDING' && pending ? ` (${pending})` : ''}
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState>No hay reseñas acá.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-muted">
                    {r.product.name} · pedido{' '}
                    <a href={`/pedidos/${r.orderItem.order.id}`} className="underline underline-offset-2">
                      #{r.orderItem.order.number}
                    </a>{' '}
                    · {formatDateTime(r.createdAt)}
                  </p>
                  <p className="mt-2 font-medium">
                    {'★'.repeat(r.rating)}
                    <span className="text-line-strong">{'★'.repeat(5 - r.rating)}</span> {r.title}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {r.authorName}
                    {r.usageTime ? ` · lo usa hace ${r.usageTime.toLowerCase()}` : ''}
                    {r.moderatedBy ? ` · revisó ${r.moderatedBy}` : ''}
                  </p>
                </div>
                <AdminForm action={moderateAction.bind(null, r.id)} submitLabel={null} className="flex gap-2">
                  {r.status !== 'APPROVED' && (
                    <SubmitButton name="status" value="APPROVED">
                      Publicar
                    </SubmitButton>
                  )}
                  {r.status !== 'REJECTED' && (
                    <SubmitButton name="status" value="REJECTED" variant="secondary">
                      Rechazar
                    </SubmitButton>
                  )}
                </AdminForm>
              </div>
              {r.status !== 'PENDING' && (
                <div className="mt-2">
                  <Badge tone={r.status === 'APPROVED' ? 'success' : 'neutral'}>{r.status === 'APPROVED' ? 'Publicada' : 'Rechazada'}</Badge>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Pagination basePath="/resenas" sp={sp} total={total} page={page} size={size} />
    </>
  )
}
