import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { Card, PageHeader } from '@/components/admin/ui'
import { deleteConcernAction, updateConcernAction } from '../actions'
import { ConcernFields } from '../fields'

export const metadata = { title: 'Necesidad' }

export default async function ConcernPage({ params }: { params: Promise<{ code: string }> }) {
  const admin = await requireAdmin('catalog.view')
  const { code } = await params
  const concern = await getDb().concern.findFirst({ where: { code, deletedAt: null } })
  if (!concern) notFound()
  return (
    <>
      <PageHeader title={concern.name} description={`Código ${concern.code}`} back={{ href: '/admin/necesidades', label: 'Necesidades' }} />
      <fieldset disabled={!can(admin.role, 'catalog.edit')} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={updateConcernAction.bind(null, concern.code)}>
            <KeepInput />
            <ConcernFields concern={concern} />
          </AdminForm>
        </Card>
        <Card title="Borrar">
          <AdminForm action={deleteConcernAction.bind(null, concern.code)} submitLabel={null}>
            <p className="text-sm text-ink-muted">Va a la papelera. No se puede mientras la usen productos o rutinas.</p>
            <SubmitButton variant="danger" confirm="¿Enviar la necesidad a la papelera?">
              Borrar necesidad
            </SubmitButton>
          </AdminForm>
        </Card>
      </fieldset>
    </>
  )
}
