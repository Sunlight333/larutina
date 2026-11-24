import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { Card, PageHeader } from '@/components/admin/ui'
import { deleteSynonymAction, updateSynonymAction } from '../actions'
import { SynonymFields } from '../fields'

export const metadata = { title: 'Sinónimo' }

export default async function SynonymPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin('catalog.view')
  const { id } = await params
  const synonym = await getDb().synonym.findUnique({ where: { id } })
  if (!synonym) notFound()
  return (
    <>
      <PageHeader title={synonym.term} back={{ href: '/sinonimos', label: 'Sinónimos' }} />
      <fieldset disabled={!can(admin.role, 'catalog.edit')} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={updateSynonymAction.bind(null, synonym.id)}>
            <KeepInput />
            <SynonymFields synonym={synonym} />
          </AdminForm>
        </Card>
        <Card title="Borrar">
          <AdminForm action={deleteSynonymAction.bind(null, synonym.id)} submitLabel={null}>
            <SubmitButton variant="danger" confirm="¿Borrar este sinónimo?">
              Borrar sinónimo
            </SubmitButton>
          </AdminForm>
        </Card>
      </fieldset>
    </>
  )
}
