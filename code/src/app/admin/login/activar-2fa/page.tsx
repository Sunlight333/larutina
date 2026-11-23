import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { getDb } from '@/server/db'
import { currentAdmin } from '@/server/auth/session'
import { generateSecret, otpauthUrl } from '@/server/auth/totp'
import { getSettings } from '@/server/settings'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { logout, verifyCode } from '../actions'

// First sign-in: 2FA is mandatory for every panel user (ADM-01). The secret
// is stored when this page first renders and activated by the first valid code.
export default async function EnrolPage() {
  const admin = await currentAdmin()
  if (!admin) redirect('/admin/login')
  if (admin.mfaPassed) redirect('/admin')
  if (admin.totpEnabled) redirect('/admin/login/codigo')

  const db = getDb()
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })
  const secret = user.totpSecret ?? generateSecret()
  if (!user.totpSecret) await db.adminUser.update({ where: { id: user.id }, data: { totpSecret: secret } })
  const issuer = `${(await getSettings())['brand.name']} panel`
  const svg = await QRCode.toString(otpauthUrl(secret, user.email, issuer), { type: 'svg', margin: 1, width: 200 })

  return (
    <>
      <h1 className="text-lg font-semibold">Activá la verificación en dos pasos</h1>
      <ol className="mb-5 mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li>Abrí una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Escaneá el código o cargá la clave a mano.</li>
        <li>Escribí el código de 6 dígitos que te muestra.</li>
      </ol>
      <div className="mx-auto mb-3 w-[200px]" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mb-5 break-all text-center font-mono text-xs text-ink-muted">{secret.match(/.{1,4}/g)?.join(' ')}</p>
      <AdminForm action={verifyCode} submitLabel="Activar e ingresar">
        <TextField name="code" label="Código" required maxLength={7} placeholder="123456" />
      </AdminForm>
      <form action={logout} className="mt-4">
        <button className="text-sm text-ink-muted underline">Cancelar</button>
      </form>
    </>
  )
}
