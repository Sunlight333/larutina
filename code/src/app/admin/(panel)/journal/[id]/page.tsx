import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { siteHref } from '@/lib/hosts'
import { mediaUrl } from '@/server/media'
import { articleDraft, articleStatus } from '@/server/services/content/articles'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { ImageField, LinesField, Select, TextArea, TextField } from '@/components/admin/fields'
import { KeepFormValues } from '@/components/admin/keep-values'
import { AdminLink, Card, DefinitionList, PageHeader, formatDateTime } from '@/components/admin/ui'
import { PageStatusBadge } from '@/components/content/status-badge'
import { deleteArticleAction, saveArticleAction, unpublishArticleAction } from '../actions'

export const metadata = { title: 'Editar artículo' }

const MARKDOWN_HELP = 'Párrafos de 3 o 4 líneas. Admite ## Título, ### Subtítulo, **negrita**, *cursiva*, [texto](/link), listas con "- " o "1. " y citas con "> ". Podés usar variables como {productos}.'

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('content.edit')
  const { id } = await params
  const db = getDb()
  const [a, categories] = await Promise.all([db.article.findUnique({ where: { id } }), db.articleCategory.findMany({ orderBy: { position: 'asc' } })])
  if (!a || a.deletedAt) notFound()
  const d = articleDraft(a)
  const status = articleStatus(a)

  return (
    <>
      <PageHeader
        title={d.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code>/journal/{a.slug}</code> <PageStatusBadge status={status} female={false} />
          </span>
        }
        back={{ href: '/journal', label: 'Journal' }}
        actions={
          <>
            <AdminLink href={siteHref(`/journal/${a.slug}?vista-previa=1`)} target="_blank">
              Vista previa
            </AdminLink>
            {a.published && (
              <AdminLink href={siteHref(`/journal/${a.slug}`)} target="_blank" variant="ghost">
                Ver en el sitio
              </AdminLink>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <AdminForm
          action={saveArticleAction.bind(null, a.id)}
          submitLabel="Guardar borrador"
          extraButtons={
            <SubmitButton name="intent" value="publish" variant="secondary" confirm="Se guarda y se publica: el journal pasa a mostrar esta versión. ¿Seguimos?">
              Publicar
            </SubmitButton>
          }
        >
          <KeepFormValues />
          <Card title="Artículo">
            <div className="space-y-4">
              <TextField name="title" label="Título (H1)" defaultValue={d.title} required maxLength={160} />
              <TextField name="slug" label="Dirección" defaultValue={a.slug} disabled={!!a.publishedAt} help={a.publishedAt ? 'No cambia después de publicar, para no romper links.' : 'Minúsculas y guiones.'} />
              <TextArea name="excerpt" label="Bajada" defaultValue={d.excerpt} rows={2} help="Una oración. También es la descripción para Google." />
              <Select name="categorySlug" label="Categoría" defaultValue={d.categorySlug} allowEmpty="Sin categoría" options={categories.map((c) => ({ value: c.slug, label: c.name }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="author" label="Autor" defaultValue={d.author} placeholder="Larutina" help="Vacío: Larutina." />
                <TextField name="reviewedBy" label="Revisado por" defaultValue={d.reviewedBy} help="Nombre y profesión, solo si una profesional lo revisó." />
              </div>
              <ImageField key={d.coverImage} name="coverImage" label="Portada" defaultKey={d.coverImage} previewUrl={d.coverImage ? mediaUrl(d.coverImage) : null} help="Horizontal, 1600 × 900. JPG, PNG, WebP o AVIF." />
              <TextField name="coverAlt" label="Texto alternativo de la portada" defaultValue={d.coverAlt} />
              <TextArea name="body" label="Cuerpo" defaultValue={d.body} rows={22} help={MARKDOWN_HELP} />
            </div>
          </Card>
          <Card title="Insertados y relacionados">
            <div className="grid gap-4 sm:grid-cols-3">
              <LinesField name="productCodes" label="Productos (códigos)" defaultValues={d.productCodes} rows={4} help="Uno por línea." />
              <LinesField name="routineCodes" label="Rutinas (códigos)" defaultValues={d.routineCodes} rows={4} />
              <LinesField name="relatedSlugs" label="Relacionados (direcciones)" defaultValues={d.relatedSlugs} rows={4} help="Vacío: los últimos de la categoría." />
            </div>
          </Card>
          <Card title="Google">
            <div className="space-y-4">
              <TextField name="seoTitle" label="Título para Google" defaultValue={d.seoTitle} maxLength={70} help='Vacío: el título. Se le suma " · Journal Larutina".' />
              <TextArea name="seoDescription" label="Descripción para Google" defaultValue={d.seoDescription} rows={2} help="Vacío: la bajada. Hasta 155 caracteres." />
            </div>
          </Card>
        </AdminForm>
        <div className="space-y-4">
          <Card title="Estado">
            <DefinitionList
              items={[
                ['Primera publicación', a.publishedAt ? formatDateTime(a.publishedAt) : 'Nunca'],
                ['Última edición', formatDateTime(a.updatedAt)],
              ]}
            />
          </Card>
          <Card title="Más acciones">
            <div className="space-y-3">
              {a.published && (
                <AdminForm action={unpublishArticleAction.bind(null, a.id)} submitLabel={null} extraButtons={<SubmitButton variant="secondary" confirm="El artículo deja de verse en el sitio. ¿Seguimos?">Despublicar</SubmitButton>}>
                  {null}
                </AdminForm>
              )}
              <AdminForm action={deleteArticleAction.bind(null, a.id)} submitLabel={null} extraButtons={<SubmitButton variant="danger" confirm="El artículo pasa a la papelera. ¿Seguimos?">Borrar</SubmitButton>}>
                {null}
              </AdminForm>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
