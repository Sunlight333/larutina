import { getDb } from '@/server/db'
import { setLineQuantity } from '@/server/commerce/cart'
import { browserCart, cartGuard, cartJson, readJson } from '@/server/commerce/cart-cookie'

// PATCH /api/cart/items/:id { quantity } and DELETE /api/cart/items/:id: the
// [− cantidad +] and "Eliminar" of a line (BO-02). Only lines of this
// browser's cart are touched; reading the cart back trims to the stock (BO-11).
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const refused = await cartGuard('write')
  if (refused) return refused
  const { id } = await ctx.params
  const body = (await readJson(req)) as { quantity?: unknown } | null
  const { cartId } = await browserCart({ create: false, write: true })
  const quantity = Number(body?.quantity)
  if (cartId && Number.isFinite(quantity)) await setLineQuantity(getDb(), cartId, id, quantity)
  return cartJson(cartId)
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const refused = await cartGuard('write')
  if (refused) return refused
  const { id } = await ctx.params
  const { cartId } = await browserCart({ create: false, write: true })
  if (cartId) await setLineQuantity(getDb(), cartId, id, 0)
  return cartJson(cartId)
}
