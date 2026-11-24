import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { siteHref } from '@/lib/hosts'
import { blockCatalog } from '@/server/services/content/blocks'
import { draftOf, HOME_SLUG, PAGE_KIND_LABELS, pageStatus } from '@/server/services/content/pages'
import { VARIABLE_HELP } from '@/lib/copy-variables'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextArea, TextField } from '@/components/admin/fields'
import { KeepFormValues } from '@/components/admin/keep-values'
import { AdminLink, Card, DefinitionList, PageHeader, formatDateTime } from '@/components/admin/ui'
import { BlockEditor } from '@/components/content/block-editor'
import { PageStatusBadge } from '@/components/content/status-badge'
import { deletePageAction, savePageAction, unpublishPageAction } from '../actions'

export const metadata = { title: 'Editar página' }

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('content.edit')
  const { id } = await params
  const page = await getDb().page.findUnique({ where: { id } })
  if (!page || page.deletedAt) notFound()
  const doc = draftOf(page)
  const status = pageStatus(page)
  const isHome = page.slug === HOME_SLUG
  const url = siteHref(isHome ? '/' : `/${page.slug}`)

  return (
    <>
      <PageHeader
        title={doc.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code>{url}</code> · {PAGE_KIND_LABELS[page.kind]} <PageStatusBadge status={status} />
          </span>
        }
        back={{ href: '/paginas', label: 'Home y páginas' }}
        actions={
          <>
            <AdminLink href={`${url}?vista-previa=1`} target="_blank">
              Vista previa
            </AdminLink>
            {page.published && (
              <AdminLink href={url} target="_blank" variant="ghost">
                Ver en el sitio
              </AdminLink>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <AdminForm
          action={savePageAction.bind(null, page.id)}
          submitLabel="Guardar borrador"
          extraButtons={
            <SubmitButton name="intent" value="publish" variant="secondary" confirm="Se guarda el borrador y se publica: el sitio pasa a mostrar esta versión. ¿Seguimos?">
              Publicar
            </SubmitButton>
          }
        >
          <KeepFormValues />
          <Card title="Página">
            <div className="space-y-4">
              <TextField name="title" label={isHome ? 'Nombre interno' : 'Título (H1)'} defaultValue={doc.title} required maxLength={160} />
              <TextField
                name="seoTitle"
                label="Título para Google"
                defaultValue={doc.seoTitle}
                maxLength={70}
                help={isHome ? 'Completo, con la marca: se usa tal cual.' : 'Vacío: el título. Se le suma " · Larutina Beauty".'}
              />
              <TextArea name="seoDescription" label="Descripción para Google" defaultValue={doc.seoDescription} rows={2} help="Hasta 155 caracteres." />
            </div>
          </Card>
          <Card title="Bloques" description="En el orden en que se ven. Los ocultos se guardan pero no se muestran.">
            <BlockEditor catalog={blockCatalog()} initial={doc.blocks} />
          </Card>
        </AdminForm>

        <div className="space-y-4">
          <Card title="Estado">
            <DefinitionList
              items={[
                ['Publicada', page.publishedAt ? formatDateTime(page.publishedAt) : 'Nunca'],
                ['Última edición', formatDateTime(page.updatedAt)],
              ]}
            />
            <p className="mt-3 text-xs text-ink-muted">“Vista previa” muestra el último borrador guardado; solo lo ve el equipo con sesión.</p>
          </Card>
          <Card title="Variables en los textos">
            <ul className="space-y-1 text-sm">
              {Object.entries(VARIABLE_HELP).map(([k, v]) => (
                <li key={k}>
                  <code className="rounded bg-shell px-1">{`{${k}}`}</code> {v}
                </li>
              ))}
            </ul>
          </Card>
          {!isHome && (
            <Card title="Más acciones">
              <div className="space-y-3">
                {page.published && (
                  <AdminForm action={unpublishPageAction.bind(null, page.id)} submitLabel={null} extraButtons={<SubmitButton variant="secondary" confirm="La página deja de verse en el sitio. ¿Seguimos?">Despublicar</SubmitButton>}>
                    {null}
                  </AdminForm>
                )}
                <AdminForm action={deletePageAction.bind(null, page.id)} submitLabel={null} extraButtons={<SubmitButton variant="danger" confirm="La página pasa a la papelera y deja de verse en el sitio. ¿Seguimos?">Borrar</SubmitButton>}>
                  {null}
                </AdminForm>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
