import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { articleDraft, articleStatus } from '@/server/services/content/articles'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { AdminLink, Card, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { PageStatusBadge } from '@/components/content/status-badge'
import { createArticleAction } from './actions'

export const metadata = { title: 'Journal' }

export default async function JournalList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('content.edit')
  const sp = await searchParams
  const db = getDb()
  const q = param(sp, 'q')?.trim()
  const { skip, take, page, size } = pageOf(sp, 30)
  const where = { deletedAt: null, ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}) }
  const [rows, total, categories] = await Promise.all([db.article.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }), db.article.count({ where }), db.articleCategory.findMany()])
  const catName = new Map(categories.map((c) => [c.slug, c.name]))
  return (
    <>
      <PageHeader title="Journal" description="Artículos con autor, “Revisado por”, productos y rutinas insertados. Se editan como borrador y se ven al publicar." actions={<AdminLink href="/admin/journal/categorias">Categorías</AdminLink>} />
      {param(sp, 'borrado') !== undefined && (
        <div className="mb-4">
          <Notice tone="success">El artículo pasó a la papelera.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <FilterBar sp={sp} placeholder="Buscar por título" />
          <DataTable
            rows={rows}
            rowKey={(a) => a.id}
            empty="Todavía no hay artículos."
            columns={[
              {
                key: 'title',
                label: 'Artículo',
                render: (a) => (
                  <Link href={`/admin/journal/${a.id}`} className="font-medium underline-offset-2 hover:underline">
                    {a.title}
                  </Link>
                ),
              },
              { key: 'cat', label: 'Categoría', render: (a) => catName.get(articleDraft(a).categorySlug) ?? '—' },
              { key: 'status', label: 'Estado', render: (a) => <PageStatusBadge status={articleStatus(a)} female={false} /> },
              { key: 'updated', label: 'Última edición', render: (a) => formatDateTime(a.updatedAt) },
            ]}
          />
          <Pagination basePath="/admin/journal" sp={sp} total={total} page={page} size={size} />
        </div>
        <Card title="Nuevo artículo">
          <AdminForm action={createArticleAction} submitLabel="Crear borrador">
            <TextField name="title" label="Título" required />
            <TextField name="slug" label="Dirección" help="Opcional: sale del título. Queda en /journal/doble-limpieza." placeholder="doble-limpieza" />
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
