import { redirect } from 'next/navigation'
import { currentAdmin } from '@/server/auth/session'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { logout, verifyCode } from '../actions'

export default async function CodePage() {
  const admin = await currentAdmin()
  if (!admin) redirect('/admin/login')
  if (admin.mfaPassed) redirect('/admin')
  if (!admin.totpEnabled) redirect('/admin/login/activar-2fa')
  return (
    <>
      <h1 className="text-lg font-semibold">Código de verificación</h1>
      <p className="mb-5 mt-1 text-sm text-ink-muted">Abrí tu app de autenticación y escribí el código de 6 dígitos.</p>
      <AdminForm action={verifyCode} submitLabel="Ingresar">
        <TextField name="code" label="Código" required maxLength={7} placeholder="123456" />
      </AdminForm>
      <form action={logout} className="mt-4">
        <button className="text-sm text-ink-muted underline">Usar otra cuenta</button>
      </form>
    </>
  )
}
