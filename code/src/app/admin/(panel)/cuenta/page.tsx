import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { requireAdmin } from '@/server/auth/session'
import { hashPassword, passwordProblem, verifyPassword } from '@/server/auth/password'
import { ROLE_LABELS } from '@/server/auth/permissions'
import { fail, ok, type FormState } from '@/server/admin/forms'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { Card, DefinitionList, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Mi cuenta' }

async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  'use server'
  const admin = await requireAdmin()
  const db = getDb()
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  if (!(await verifyPassword(current, user.passwordHash))) return fail('La contraseña actual no coincide.', { current: 'No coincide.' })
  const problem = passwordProblem(next)
  if (problem) return fail(problem, { next: problem })
  if (next !== form.get('repeat')) return fail('Las contraseñas nuevas no coinciden.', { repeat: 'No coincide.' })
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } })
    await tx.adminSession.deleteMany({ where: { userId: user.id, id: { not: admin.sessionId } } })
    await audit(tx, admin, { action: 'user.change-password', entityType: 'AdminUser', entityId: user.id, label: user.email })
  })
  return ok('Contraseña cambiada. Se cerraron tus otras sesiones.')
}

export default async function AccountPage() {
  const admin = await requireAdmin()
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Datos">
          <DefinitionList items={[['Nombre', admin.name], ['Email', admin.email], ['Rol', ROLE_LABELS[admin.role]], ['Verificación en dos pasos', 'Activa']]} />
        </Card>
        <Card title="Cambiar contraseña">
          <AdminForm action={changePassword} submitLabel="Cambiar contraseña" resetOnSuccess>
            <TextField name="current" label="Contraseña actual" type="password" required />
            <TextField name="next" label="Contraseña nueva" type="password" required help="Al menos 12 caracteres." />
            <TextField name="repeat" label="Repetí la contraseña nueva" type="password" required />
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
