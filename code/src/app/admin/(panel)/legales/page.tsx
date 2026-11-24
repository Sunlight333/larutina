import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { LEGAL_DOCUMENTS, listLegalDocuments } from '@/server/services/content/legal'
import { AdminForm } from '@/components/admin/form'
import { DataTable } from '@/components/admin/table'
import { Badge, Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { seedContentAction } from '../paginas/actions'

export const metadata = { title: 'Legales' }

export default async function LegalList() {
  await requireAdmin('content.edit')
  const docs = await listLegalDocuments(getDb())
  const missing = LEGAL_DOCUMENTS.filter((d) => !docs.some((x) => x.code === d.code))
  return (
    <>
      <PageHeader
        title="Legales"
        description="Cada texto se edita como borrador. “Publicar versión” agrega una versión nueva y las anteriores quedan guardadas con su fecha. El footer muestra solo los documentos con una versión publicada."
      />
      <div className="space-y-6">
        {missing.length > 0 && (
          <Card title="Faltan documentos" description={`Todavía no existen: ${missing.map((m) => m.title).join(', ')}. Se crean con el borrador del archivo de contenido.`}>
            <AdminForm action={seedContentAction} submitLabel="Crear los que faltan">
              {null}
            </AdminForm>
          </Card>
        )}
        <DataTable
          rows={docs}
          rowKey={(d) => d.id}
          empty="No hay documentos legales."
          columns={[
            {
              key: 'title',
              label: 'Documento',
              render: (d) => (
                <Link href={`/legales/${d.id}`} className="font-medium underline-offset-2 hover:underline">
                  {d.title}
                </Link>
              ),
            },
            { key: 'url', label: 'Dirección', render: (d) => <code className="text-xs">/legales/{d.code}</code> },
            { key: 'version', label: 'Versión vigente', render: (d) => (d.latest ? `v${d.latest.version} · ${formatDateTime(d.latest.publishedAt)}` : '—') },
            {
              key: 'state',
              label: 'Estado',
              render: (d) => (!d.latest ? <Badge>Sin publicar</Badge> : d.pendingChanges ? <Badge tone="warning">Cambios sin publicar</Badge> : <Badge tone="success">Publicado</Badge>),
            },
          ]}
        />
      </div>
    </>
  )
}
