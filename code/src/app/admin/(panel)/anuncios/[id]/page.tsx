import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Card, PageHeader } from '@/components/admin/ui'
import { deleteAnnouncementAction, updateAnnouncementAction } from '../actions'
import { AnnouncementFields } from '../fields'

export const metadata = { title: 'Anuncio' }

export default async function EditAnnouncement({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('content.edit')
  const { id } = await params
  const a = await getDb().announcement.findUnique({ where: { id } })
  if (!a) notFound()
  return (
    <>
      <PageHeader title="Anuncio" back={{ href: '/anuncios', label: 'Barra de anuncios' }} />
      <div className="max-w-xl space-y-4">
        <Card>
          <AdminForm action={updateAnnouncementAction.bind(null, a.id)}>
            <AnnouncementFields value={a} />
          </AdminForm>
        </Card>
        <AdminForm action={deleteAnnouncementAction.bind(null, a.id)} submitLabel={null} extraButtons={<SubmitButton variant="danger" confirm="¿Borrar este anuncio?">Borrar anuncio</SubmitButton>}>
          {null}
        </AdminForm>
      </div>
    </>
  )
}
