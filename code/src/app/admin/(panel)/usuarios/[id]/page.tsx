import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { PERMISSIONS, permissionsOf, ROLE_LABELS } from '@/server/auth/permissions'
import { AdminForm } from '@/components/admin/form'
import { Checkbox, Select, TextField } from '@/components/admin/fields'
import { Card, DefinitionList, PageHeader, formatDateTime } from '@/components/admin/ui'
import { resetPassword, resetTwoFactor, updateUser } from '../actions'

export const metadata = { title: 'Usuario' }

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('users.manage')
  const { id } = await params
  const user = await getDb().adminUser.findUnique({ where: { id } })
  if (!user) notFound()
  return (
    <>
      <PageHeader title={user.name} description={user.email} back={{ href: '/admin/usuarios', label: 'Usuarios' }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Datos y rol">
          <AdminForm action={updateUser.bind(null, user.id)}>
            <TextField name="name" label="Nombre" defaultValue={user.name} required />
            <Select name="role" label="Rol" options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={user.role} />
            <Checkbox name="active" label="Activo" defaultChecked={user.active} help="Desactivar cierra sus sesiones al instante." />
          </AdminForm>
        </Card>
        <div className="space-y-6">
          <Card title="Acceso">
            <DefinitionList
              items={[
                ['Verificación en dos pasos', user.totpEnabledAt ? `Activa desde ${formatDateTime(user.totpEnabledAt)}` : 'Se configura en el primer ingreso'],
                ['Último ingreso', formatDateTime(user.lastLoginAt)],
                ['Bloqueado hasta', user.lockedUntil && user.lockedUntil > new Date() ? formatDateTime(user.lockedUntil) : '—'],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminForm action={resetPassword.bind(null, user.id)} submitLabel="Generar contraseña temporal" className="space-y-2">
                {null}
              </AdminForm>
              <AdminForm action={resetTwoFactor.bind(null, user.id)} submitLabel="Reiniciar 2FA" className="space-y-2">
                {null}
              </AdminForm>
            </div>
          </Card>
          <Card title={`Qué puede hacer el rol ${ROLE_LABELS[user.role]}`}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {permissionsOf(user.role).map((p) => (
                <li key={p}>{PERMISSIONS[p]}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
