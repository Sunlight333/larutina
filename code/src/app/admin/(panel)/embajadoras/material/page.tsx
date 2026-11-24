import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { Card, EmptyState, PageHeader } from '@/components/admin/ui'
import { addMaterialAction, deleteMaterialAction } from './actions'

export const metadata = { title: 'Material para embajadoras' }

// EB-18: files and links the ambassadors see in their panel.
export default async function MaterialPage() {
  await requireAdmin('ambassadors.manage')
  const items = await getDb().ambassadorMaterial.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  return (
    <>
      <PageHeader title="Material para embajadoras" description="Fichas técnicas, capacitaciones e imágenes para compartir. Lo ven solo las embajadoras activas, en su panel." back={{ href: '/embajadoras', label: 'Embajadoras' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title="Material">
          {items.length === 0 ? (
            <EmptyState>Todavía no hay material.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-ink-muted">{m.kind === 'link' ? m.url : m.fileName}</p>
                  </div>
                  <AdminForm action={deleteMaterialAction.bind(null, m.id)} submitLabel={null}>
                    <SubmitButton variant="ghost" confirm="¿Sacar este material?">Sacar</SubmitButton>
                  </AdminForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Agregar">
          <AdminForm action={addMaterialAction} submitLabel="Agregar" resetOnSuccess>
            <TextField name="title" label="Título" required />
            <TextField name="url" label="Link (o subí un archivo)" type="url" />
            <div className="space-y-1.5">
              <label htmlFor="material-file" className="block text-sm font-medium">Archivo</label>
              <input id="material-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm" />
              <p className="text-xs text-ink-muted">PDF o imagen, hasta 10 MB.</p>
            </div>
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
