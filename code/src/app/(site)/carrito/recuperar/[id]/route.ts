import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { recoverCart } from '@/server/commerce/cart-access'
import { setCartCookie } from '@/server/commerce/cart-cookie'
import { verify } from '@/server/secret'

// /carrito/recuperar/:id?t=…: the link of the abandoned-cart email (EML-04).
// A valid signature points this browser's cookie at that cart (with a new
// token); then, valid or not, the cart page.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const url = new URL(req.url)
  const token = await recoverCart(getDb(), id, verify('cart', id, url.searchParams.get('t')))
  if (token) await setCartCookie(token)
  return NextResponse.redirect(new URL('/carrito', process.env.NEXT_PUBLIC_SITE_URL ?? url.origin), 303)
}
