import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { HOME_SLUG, listPages, PAGE_KIND_LABELS, pageStatus } from '@/server/services/content/pages'
import { AdminForm } from '@/components/admin/form'
import { Select, TextField } from '@/components/admin/fields'
import { DataTable, param, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { PageStatusBadge } from '@/components/content/status-badge'
import { createPageAction, seedContentAction } from './actions'

export const metadata = { title: 'Home y páginas' }

export default async function PagesList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('content.edit')
  const sp = await searchParams
  const pages = await listPages(getDb())
  const hasHome = pages.some((p) => p.slug === HOME_SLUG)
  return (
    <>
      <PageHeader title="Home y páginas" description="La Home, las landings y las páginas institucionales y de ayuda se arman con bloques. Los cambios se guardan como borrador y se ven en el sitio al publicar." />
      <div className="space-y-6">
        {param(sp, 'borrada') !== undefined && <Notice tone="success">La página pasó a la papelera. Se puede restaurar desde Papelera.</Notice>}
        {!hasHome && (
          <Card title="Contenido inicial" description="Carga la Home, Nosotras, Preguntas frecuentes, Envíos y devoluciones, las categorías del journal, los borradores legales y los anuncios con los textos del archivo de contenido. Solo crea lo que falta.">
            <AdminForm action={seedContentAction} submitLabel="Cargar el contenido inicial">
              {null}
            </AdminForm>
          </Card>
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <DataTable
            rows={pages}
            rowKey={(p) => p.id}
            empty="Todavía no hay páginas."
            columns={[
              {
                key: 'title',
                label: 'Página',
                render: (p) => (
                  <Link className="font-medium underline-offset-2 hover:underline" href={`/admin/paginas/${p.id}`}>
                    {p.title}
                  </Link>
                ),
              },
              { key: 'url', label: 'Dirección', render: (p) => <code className="text-xs">{p.slug === HOME_SLUG ? '/' : `/${p.slug}`}</code> },
              { key: 'kind', label: 'Tipo', render: (p) => PAGE_KIND_LABELS[p.kind] },
              { key: 'status', label: 'Estado', render: (p) => <PageStatusBadge status={pageStatus(p)} /> },
              { key: 'updated', label: 'Última edición', render: (p) => formatDateTime(p.updatedAt) },
            ]}
          />
          <Card title="Nueva página">
            <AdminForm action={createPageAction} submitLabel="Crear página">
              <TextField name="title" label="Título" required />
              <TextField name="slug" label="Dirección" required placeholder="cuidado-de-verano" help="Minúsculas y guiones. La página queda en larutinabeauty.com/cuidado-de-verano." />
              <Select
                name="kind"
                label="Tipo"
                defaultValue="LANDING"
                options={[
                  { value: 'LANDING', label: 'Landing (campaña)' },
                  { value: 'INSTITUTIONAL', label: 'Institucional' },
                  { value: 'HELP', label: 'Ayuda' },
                ]}
              />
            </AdminForm>
          </Card>
        </div>
      </div>
    </>
  )
}
