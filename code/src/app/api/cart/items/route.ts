import { getDb } from '@/server/db'
import { addToCart } from '@/server/commerce/cart'
import { cleanAddInput } from '@/server/commerce/cart-access'
import { browserCart, cartGuard, cartJson, readJson } from '@/server/commerce/cart-cookie'

// POST /api/cart/items { sku, quantity, source, sourceRef }: adds a size to
// the cart, creating the cart (and its cookie) on the first add. `source` is
// where the button was (PDP, LISTING, SEARCH…), for attribution (CMP-01).
export async function POST(req: Request) {
  const refused = await cartGuard('write')
  if (refused) return refused
  const input = cleanAddInput(await readJson(req))
  if (!input) return cartJson((await browserCart({ create: false, write: true })).cartId, { error: 'Sin stock por ahora', status: 400 })
  const db = getDb()
  const { cartId } = await browserCart({ create: true, write: true })
  const before = await db.cartItem.findFirst({ where: { cartId: cartId!, variant: { sku: input.sku } }, select: { quantity: true, variant: { select: { product: { select: { name: true } } } } } })
  const added = await addToCart(db, cartId!, input)
  // G-13 when it cannot be bought; BO-11's wording when the line already has all there is.
  if (!added) return cartJson(cartId, { error: 'Sin stock por ahora', status: 409 })
  if (before && added.quantity <= before.quantity) {
    const n = added.quantity
    return cartJson(cartId, { error: `Quedan ${n} ${n === 1 ? 'unidad' : 'unidades'} de ${before.variant.product.name}.`, status: 409 })
  }
  return cartJson(cartId, { message: 'Listo, lo sumamos a tu carrito.' })
}
