import { createHash, randomBytes } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { AdminRole } from '@prisma/client'
import { getDb } from '@/server/db'
import { SESSION_COOKIE_DOMAIN } from '@/lib/hosts'
import { can, type Permission } from './permissions'

// Admin sessions in the database (ADR-009): the cookie holds a random token,
// the table its SHA-256, so a leaked table cannot be replayed. 12 h absolute,
// 2 h idle. The panel runs on admin.larutinabeauty.com; the cookie is set for
// the whole domain, path "/", so the storefront can recognise the team while
// the site is in waitlist or maintenance mode, and for previews (GEN-09).

export const SESSION_COOKIE = 'lr_admin'
const ABSOLUTE_MS = 12 * 60 * 60 * 1000
const IDLE_MS = 2 * 60 * 60 * 1000
const TOUCH_MS = 5 * 60 * 1000

export type AdminSessionUser = {
  id: string
  email: string
  name: string
  role: AdminRole
  totpEnabled: boolean
  mfaPassed: boolean
  sessionId: string
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(userId: string, opts: { mfaPassed: boolean; ip?: string; userAgent?: string | null }) {
  const token = randomBytes(32).toString('base64url')
  await getDb().adminSession.create({
    data: { id: hashToken(token), userId, mfaPassed: opts.mfaPassed, expiresAt: new Date(Date.now() + ABSOLUTE_MS), ip: opts.ip, userAgent: opts.userAgent?.slice(0, 300) },
  })
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: SESSION_COOKIE_DOMAIN,
    maxAge: ABSOLUTE_MS / 1000,
  })
}

export async function markMfaPassed(sessionId: string) {
  await getDb().adminSession.update({ where: { id: sessionId }, data: { mfaPassed: true } })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await getDb().adminSession.deleteMany({ where: { id: hashToken(token) } })
  // Only a delete with the same Domain removes the cookie.
  jar.delete({ name: SESSION_COOKIE, path: '/', domain: SESSION_COOKIE_DOMAIN })
}

/** The signed-in admin for this request, or null. Does not require 2FA. */
export const currentAdmin = cache(async (): Promise<AdminSessionUser | null> => {
  if (!process.env.DATABASE_URL) return null
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const db = getDb()
  const session = await db.adminSession.findUnique({ where: { id: hashToken(token) }, include: { user: true } })
  const now = Date.now()
  if (!session || session.expiresAt.getTime() <= now || now - session.lastSeenAt.getTime() > IDLE_MS || !session.user.active) {
    if (session) await db.adminSession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_MS) {
    await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {})
  }
  const u = session.user
  return { id: u.id, email: u.email, name: u.name, role: u.role, totpEnabled: !!u.totpEnabledAt, mfaPassed: session.mfaPassed, sessionId: session.id }
})

/** A fully signed-in admin (password and 2FA): the team, for the site gate and previews. */
export async function teamMember(): Promise<AdminSessionUser | null> {
  const admin = await currentAdmin()
  return admin?.mfaPassed ? admin : null
}

/**
 * For every admin page and server action. Sends to login or 2FA as needed;
 * without the permission, back to the panel home with a notice.
 */
export async function requireAdmin(permission?: Permission): Promise<AdminSessionUser> {
  const admin = await currentAdmin()
  if (!admin) redirect('/login')
  if (!admin.mfaPassed) redirect(admin.totpEnabled ? '/login/codigo' : '/login/activar-2fa')
  if (permission && !can(admin.role, permission)) redirect('/?sin-permiso=1')
  return admin
}
