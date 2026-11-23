'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { createSession, currentAdmin, destroySession, markMfaPassed } from '@/server/auth/session'
import { verifyTotp } from '@/server/auth/totp'
import { rateLimit } from '@/server/rate-limit'
import { clientIp, userAgent } from '@/server/request'
import { fail, str, type FormState } from '@/server/admin/forms'

const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000
let dummyHash: Promise<string> | undefined

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000).ok) return fail('Demasiados intentos desde esta conexión. Esperá unos minutos.')
  const email = str(form, 'email').toLowerCase()
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : ''
  const db = getDb()
  const user = await db.adminUser.findUnique({ where: { email } })

  if (!user || !user.active) {
    // Same work as a real check, so timing does not reveal which emails exist.
    dummyHash ??= hashPassword('not-a-real-password')
    await verifyPassword(password, await dummyHash)
    return fail('El email o la contraseña no coinciden.')
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return fail('La cuenta está bloqueada unos minutos por intentos fallidos.')

  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1
    await db.adminUser.update({
      where: { id: user.id },
      data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: fails },
    })
    await audit(db, { id: user.id, email: user.email }, { action: 'login.failed', entityType: 'AdminUser', entityId: user.id, label: user.email, ip })
    return fail('El email o la contraseña no coinciden.')
  }

  await db.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
  await createSession(user.id, { mfaPassed: false, ip, userAgent: await userAgent() })
  redirect(user.totpEnabledAt ? '/admin/login/codigo' : '/admin/login/activar-2fa')
}

/** Second step: the 6-digit code from the authenticator app. */
export async function verifyCode(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await currentAdmin()
  if (!admin) redirect('/admin/login')
  if (!rateLimit(`totp:${admin.sessionId}`, 8, 15 * 60 * 1000).ok) {
    await destroySession()
    redirect('/admin/login')
  }
  const db = getDb()
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })
  if (!user.totpSecret) redirect('/admin/login/activar-2fa')
  const step = verifyTotp(user.totpSecret, str(form, 'code'), user.totpLastStep)
  if (step === null) return fail('El código no es válido o ya se usó. Probá con el siguiente.', { code: 'Código incorrecto' })

  const enrolling = !user.totpEnabledAt
  await db.adminUser.update({
    where: { id: user.id },
    data: { totpLastStep: step, lastLoginAt: new Date(), ...(enrolling ? { totpEnabledAt: new Date() } : {}) },
  })
  await markMfaPassed(admin.sessionId)
  await audit(db, { id: user.id, email: user.email }, { action: enrolling ? 'login.2fa-enabled' : 'login', entityType: 'AdminUser', entityId: user.id, label: user.email, ip: await clientIp() })
  redirect('/admin')
}

export async function logout() {
  const admin = await currentAdmin()
  if (admin) await audit(getDb(), { id: admin.id, email: admin.email }, { action: 'logout', entityType: 'AdminUser', entityId: admin.id, label: admin.email })
  await destroySession()
  redirect('/admin/login')
}
