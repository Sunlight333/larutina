import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { getSettings } from '@/server/settings'
import { encodeRef, REF_COOKIE } from '@/lib/commerce/attribution'
import { approvedByCode, linkAccountToAmbassador, recordVisit } from '@/server/ambassadors/program'
import { browserCart } from '@/server/commerce/cart-cookie'
import { catalogViewer } from '@/server/services/catalog/viewer'

const VISITOR_COOKIE = 'lr_visitor'

// EMB-02, NAV-10, G-10: a visit with an ambassador's link (?ref=CODE or
// /r/CODE). Her code is saved on this device for the window, on the cart
// (preloaded in the code field, BO-06) and, when signed in, on the account;
// the visit is counted (EB-14). Answers her first name for the banner.
export async function POST(req: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (!(await catalogViewer()).canSee) return NextResponse.json({}, { status: 404, headers })
  if (!rateLimit(`ref:${await clientIp()}`, 30, 60_000).ok) return NextResponse.json({}, { status: 429, headers })
  const body = (await req.json().catch(() => null)) as { code?: unknown; path?: unknown } | null
  const db = getDb()
  const a = typeof body?.code === 'string' ? await approvedByCode(db, body.code) : null
  if (!a?.code) return NextResponse.json({}, { status: 404, headers })

  const s = await getSettings()
  const jar = await cookies()
  const now = new Date()
  const secure = process.env.NODE_ENV === 'production'
  jar.set(REF_COOKIE, encodeRef(a.code, now), { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: s['ambassadors.windowDays'] * 86_400 })
  let visitor = jar.get(VISITOR_COOKIE)?.value
  if (!visitor || !/^[\w-]{16,64}$/.test(visitor)) {
    visitor = randomBytes(16).toString('base64url')
    jar.set(VISITOR_COOKIE, visitor, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 365 * 86_400 })
  }
  await recordVisit(db, a.id, visitor, typeof body?.path === 'string' ? body.path : '/')

  const { cartId, customer } = await browserCart({ create: true, write: true })
  if (cartId) {
    const cart = await db.cart.findUnique({ where: { id: cartId }, select: { couponCode: true } })
    await db.cart.update({ where: { id: cartId }, data: { ambassadorCode: a.code, ...(cart?.couponCode ? {} : { couponCode: a.code }) } })
  }
  if (customer) await linkAccountToAmbassador(db, customer.id, a.id, now)
  return NextResponse.json({ name: a.firstName }, { headers })
}
