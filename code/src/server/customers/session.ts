import { createHash, randomBytes } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { getDb } from '@/server/db'

// Customer sessions: the cookie holds a random token, the table its SHA-256
// (as for the panel, ADR-009). 30 days, renewed while used.

export const CUSTOMER_COOKIE = 'lr_session'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const TOUCH_MS = 24 * 60 * 60 * 1000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function startCustomerSession(customerId: string) {
  const token = randomBytes(32).toString('base64url')
  await getDb().customerSession.create({ data: { id: hashToken(token), customerId, expiresAt: new Date(Date.now() + MAX_AGE_MS) } })
  ;(await cookies()).set(CUSTOMER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE_MS / 1000 })
}

export async function endCustomerSession() {
  const jar = await cookies()
  const token = jar.get(CUSTOMER_COOKIE)?.value
  if (token) await getDb().customerSession.deleteMany({ where: { id: hashToken(token) } })
  jar.delete(CUSTOMER_COOKIE)
}

export type SessionCustomer = { id: string; email: string; firstName: string | null }

/** The signed-in customer for this request, or null. */
export const currentCustomer = cache(async (): Promise<SessionCustomer | null> => {
  if (!process.env.DATABASE_URL) return null
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  const db = getDb()
  const session = await db.customerSession.findUnique({ where: { id: hashToken(token) }, include: { customer: { select: { id: true, email: true, firstName: true } } } })
  const now = Date.now()
  if (!session || session.expiresAt.getTime() <= now) {
    if (session) await db.customerSession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_MS) {
    await db.customerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(now + MAX_AGE_MS) } }).catch(() => {})
  }
  return session.customer
})
