import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { Card, PageHeader } from '@/components/admin/ui'
import { RoutineForm } from '../routine-form'

export const metadata = { title: 'Nueva rutina' }

export default async function NewRoutinePage() {
  await requireAdmin('catalog.edit')
  const db = getDb()
  const [skinTypes, concerns] = await Promise.all([db.skinType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }), db.concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })])
  return (
    <>
      <PageHeader title="Nueva rutina" back={{ href: '/rutinas', label: 'Rutinas armadas' }} />
      <Card>
        <RoutineForm skinTypes={skinTypes} concerns={concerns} />
      </Card>
    </>
  )
}
