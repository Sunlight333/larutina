import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextArea, TextField } from '@/components/admin/fields'
import { KeepFormValues } from '@/components/admin/keep-values'
import { AdminLink, Card, EmptyState, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { saveLegalAction } from '../actions'

export const metadata = { title: 'Documento legal' }

const MARKDOWN_HELP = 'Admite ## Título, ### Subtítulo, **negrita**, *cursiva*, [texto](/link), listas con "- " o "1. " y citas con "> ".'

export default async function EditLegal({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('content.edit')
  const { id } = await params
  const doc = await getDb().legalDocument.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' } } } })
  if (!doc) notFound()
  const latest = doc.versions[0]
  const pending = !latest || latest.body !== doc.draftBody || latest.title !== doc.title
  const pendingReview = doc.draftBody.includes('Borrador pendiente de revisión legal')

  return (
    <>
      <PageHeader
        title={doc.title}
        description={<code>/legales/{doc.code}</code>}
        back={{ href: '/admin/legales', label: 'Legales' }}
        actions={
          <AdminLink href={`/legales/${doc.code}?vista-previa=1`} target="_blank">
            Vista previa del borrador
          </AdminLink>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {pendingReview && (
            <Notice tone="warning" title="Borrador pendiente de revisión legal">
              Antes de publicar, que lo revise una abogada, completá los datos marcados entre corchetes y sacá el aviso del principio.
            </Notice>
          )}
          <Card>
            <AdminForm
              action={saveLegalAction.bind(null, doc.id)}
              submitLabel="Guardar borrador"
              extraButtons={
                <SubmitButton name="intent" value="publish" variant="secondary" confirm={`Se publica como versión ${(latest?.version ?? 0) + 1}. La versión anterior queda guardada. ¿Seguimos?`}>
                  Publicar versión
                </SubmitButton>
              }
            >
              <KeepFormValues />
              <TextField name="title" label="Título" defaultValue={doc.title} required maxLength={160} />
              <TextArea name="draftBody" label="Texto" defaultValue={doc.draftBody} rows={24} help={MARKDOWN_HELP} />
            </AdminForm>
          </Card>
        </div>
        <Card title="Versiones" description={pending ? 'El borrador tiene cambios sin publicar.' : 'El borrador es igual a la versión vigente.'}>
          {doc.versions.length === 0 ? (
            <EmptyState>Todavía no se publicó ninguna versión.</EmptyState>
          ) : (
            <ol className="space-y-3 text-sm">
              {doc.versions.map((v, i) => (
                <li key={v.id}>
                  <Link href={`/legales/${doc.code}/v/${v.version}`} target="_blank" className="font-medium underline-offset-2 hover:underline">
                    Versión {v.version}
                  </Link>
                  {i === 0 && <span className="text-ink-muted"> · vigente</span>}
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(v.publishedAt)}
                    {v.publishedBy ? ` · ${v.publishedBy}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}
