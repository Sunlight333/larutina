import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// A key for signing links (order pages in emails, review links). APP_SECRET
// when the deploy sets it; otherwise derived from DATABASE_URL, which holds
// the database password and so is already secret and stable per environment.
function appSecret(): string {
  const raw = process.env.APP_SECRET || process.env.DATABASE_URL
  if (!raw) throw new Error('APP_SECRET or DATABASE_URL must be set.')
  return createHash('sha256').update(`larutina:${raw}`).digest('hex')
}

export function sign(purpose: string, value: string, length = 24): string {
  return createHmac('sha256', appSecret()).update(`${purpose}:${value}`).digest('base64url').slice(0, length)
}

export function verify(purpose: string, value: string, token: string | null | undefined, length = 24): boolean {
  if (!token) return false
  const expected = Buffer.from(sign(purpose, value, length))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
