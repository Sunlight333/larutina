import { NextResponse } from 'next/server'
import { findCartById } from '@/server/commerce/cart'
import { quoteCart, shopCart } from '@/server/commerce/cart-access'
import { browserCart, cartGuard, readJson, shopContext } from '@/server/commerce/cart-cookie'

// POST /api/cart/shipping { postcode, province? }: "Calculá el envío" in the
// cart (BO-08) and the options of step 2 (CK-06), from the same quote the
// order is placed with, cheapest first.
export async function POST(req: Request) {
  const refused = await cartGuard('quote')
  if (refused) return refused
  const body = (await readJson(req)) as { postcode?: unknown; province?: unknown } | null
  const postcode = typeof body?.postcode === 'string' ? body.postcode.slice(0, 20) : ''
  const province = typeof body?.province === 'string' ? body.province.slice(0, 2) : null
  const { cartId } = await browserCart({ create: false, write: true })
  const ctx = await shopContext()
  const { view } = await shopCart(ctx.db, await findCartById(ctx.db, cartId), ctx.s, { transferAvailable: false })
  const quote = await quoteCart(ctx.db, view, ctx.s, { postcode, province })
  return NextResponse.json(quote, { headers: { 'Cache-Control': 'no-store' } })
}
