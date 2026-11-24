// The cart of this request's browser (CMP-01): the cookie and the session on
// top of ./cart-access.ts. Pages only read (they cannot set cookies); route
// handlers and server actions may create the cart, give it a new token and
// set the cookie.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { currentCustomer } from '@/server/customers/session'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { catalogViewer } from '@/server/services/catalog/viewer'
import { CART_COOKIE, findCartById } from './cart'
import { locateCart, shopCart, type ShopCart } from './cart-access'
import { availableMethods } from './checkout'
import { paymentProvider } from './payments'

const MAX_AGE_S = 90 * 24 * 60 * 60

export async function setCartCookie(token: string) {
  ;(await cookies()).set(CART_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE_S })
}

/** The cart this browser uses. With `create`, one is made when there is none. Sets the cookie when the token changed. */
export async function browserCart(opts: { create: boolean; write: boolean }) {
  const db = getDb()
  const jar = await cookies()
  const token = jar.get(CART_COOKIE)?.value ?? null
  const customer = await currentCustomer()
  const located = await locateCart(db, token, customer?.id ?? null, { create: opts.create, retoken: opts.write })
  if (located.newToken) await setCartCookie(located.newToken)
  return { cartId: located.cartId, token: located.newToken ?? (located.cartId ? token : null), customer }
}

export async function shopContext() {
  const db = getDb()
  const s = await getSettings()
  const methods = availableMethods(s, paymentProvider(db))
  return { db, s, methods, transferAvailable: methods.includes('transfer') }
}

/** For pages: the cart as shown, fixed on read so its notices (BO-11) show once. */
export async function readShopCart() {
  const { cartId, customer } = await browserCart({ create: false, write: false })
  const ctx = await shopContext()
  const row = await findCartById(ctx.db, cartId)
  const { view, cart } = await shopCart(ctx.db, row, ctx.s, { transferAvailable: ctx.transferAvailable, fix: true })
  return { ...ctx, view, cart, customer }
}

const LIMITS = {
  read: { limit: 120, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  // Codes are guessable: few tries per connection.
  code: { limit: 12, windowMs: 10 * 60_000 },
  quote: { limit: 30, windowMs: 60_000 },
} as const

export const TOO_MANY = 'Recibimos muchos pedidos seguidos. Probá de nuevo en un rato.'

/** Every cart route: nothing while the site is closed to this visitor, and a limit per IP. Returns the refusal, or null to go on. */
export async function cartGuard(kind: keyof typeof LIMITS): Promise<NextResponse | null> {
  if (!(await catalogViewer()).canSee) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const { limit, windowMs } = LIMITS[kind]
  if (!rateLimit(`cart-${kind}:${await clientIp()}`, limit, windowMs).ok) return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  return null
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export type CartApiBody ={ cart: ShopCart; message?: string; error?: string }

/** The JSON every cart route answers with: the cart as it is now, plus a message for the action. */
export async function cartJson(cartId: string | null, extra: { message?: string; error?: string; status?: number } = {}) {
  const ctx = await shopContext()
  const { cart } = await shopCart(ctx.db, await findCartById(ctx.db, cartId), ctx.s, { transferAvailable: ctx.transferAvailable, fix: true })
  const body: CartApiBody = { cart, ...(extra.message ? { message: extra.message } : {}), ...(extra.error ? { error: extra.error } : {}) }
  return NextResponse.json(body, { status: extra.status ?? 200, headers: { 'Cache-Control': 'no-store' } })
}
