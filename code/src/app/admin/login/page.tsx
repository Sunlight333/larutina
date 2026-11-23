import { redirect } from 'next/navigation'
import { currentAdmin } from '@/server/auth/session'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { login } from './actions'

export default async function LoginPage() {
  const admin = await currentAdmin()
  if (admin?.mfaPassed) redirect('/admin')
  return (
    <>
      <h1 className="mb-5 text-lg font-semibold">Ingresar al panel</h1>
      <AdminForm action={login} submitLabel="Continuar">
        <TextField name="email" label="Email" type="email" required />
        <TextField name="password" label="Contraseña" type="password" required />
      </AdminForm>
    </>
  )
}
