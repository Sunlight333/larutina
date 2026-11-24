import { browserCart, cartGuard, cartJson } from '@/server/commerce/cart-cookie'

// GET /api/cart: this browser's cart as the storefront shows it (CMP-01):
// lines priced by the cascade, the BO-11 notices and the "Con transferencia"
// total. Never the cost (CAT-20). Nothing while the site is closed.
export async function GET() {
  const refused = await cartGuard('read')
  if (refused) return refused
  const { cartId } = await browserCart({ create: false, write: true })
  return cartJson(cartId)
}
