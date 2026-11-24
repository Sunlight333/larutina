// The request side of the account: who is signed in, where to send her when
// she is not, and what happens right after she signs in (session, cart,
// the favourite she tapped before signing in). Server only.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { CART_COOKIE, ensureCart, findCart, findCustomerCart, hashCartToken, mergeCarts, newCartToken } from '@/server/commerce/cart'
import { currentCustomer, startCustomerSession } from './session'
import { saveFavorite } from './history'
import { safeReturnPath, signInHref } from '@/lib/return-path'

const CART_MAX_AGE = 90 * 24 * 60 * 60

async function setCartCookie(token: string) {
  ;(await cookies()).set(CART_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: CART_MAX_AGE })
}

/** The signed-in customer, or a redirect to "Ingresar" that brings her back to `path`. */
export async function requireCustomer(path: string) {
  const customer = await currentCustomer()
  if (!customer) redirect(signInHref(path))
  return customer
}

/**
 * At sign-in the browser's cart joins the account (CMP-01): its lines move
 * into the account's open cart. The browser then holds the merged cart.
 */
async function joinCart(customerId: string) {
  const db = getDb()
  const token = (await cookies()).get(CART_COOKIE)?.value
  const guest = await findCart(db, token)
  if (guest && !guest.convertedAt) {
    if (guest.customerId === customerId) return
    if (guest.customerId) return // another account's cart on a shared browser: leave it
    const keptId = await mergeCarts(db, guest.id, customerId)
    if (keptId !== guest.id) {
      const fresh = newCartToken()
      await db.cart.update({ where: { id: keptId }, data: { token: hashCartToken(fresh) } })
      await setCartCookie(fresh)
    }
    return
  }
  // No cart in this browser: pick up the one she left in her account.
  const own = await findCustomerCart(db, customerId)
  if (own && own.items.length) {
    const fresh = newCartToken()
    await db.cart.update({ where: { id: own.id }, data: { token: hashCartToken(fresh) } })
    await setCartCookie(fresh)
  }
}

/** Starts the session and returns where to go: the page she came from, with the favourite saved (PDP-09). */
export async function completeSignIn(customerId: string, opts: { returnTo: unknown; save: unknown }): Promise<string> {
  await startCustomerSession(customerId)
  await joinCart(customerId).catch((e) => console.error('[cuenta] could not join the cart', e))
  if (typeof opts.save === 'string' && /^[a-z0-9-]{1,120}$/.test(opts.save)) await saveFavorite(getDb(), customerId, opts.save)
  return safeReturnPath(opts.returnTo)
}

/** The cart this browser writes to, created on first use; the cookie is set when it is new. */
export async function browserCartId(customerId: string | null): Promise<string> {
  const token = (await cookies()).get(CART_COOKIE)?.value
  const { cartId, newToken } = await ensureCart(getDb(), token, customerId)
  if (newToken) await setCartCookie(newToken)
  return cartId
}
