import { getDb } from '@/server/db'
import { findCartById, setCoupon, viewCart } from '@/server/commerce/cart'
import { COUPON_ERRORS, normalizeCode } from '@/server/commerce/coupons'
import { browserCart, cartGuard, cartJson, readJson } from '@/server/commerce/cart-cookie'
import { getSettings } from '@/server/settings'

// POST /api/cart/code { code } and DELETE /api/cart/code (BO-06): "Código [X]
// aplicado." or the reason it does not apply. A code that does not apply is
// not kept. The checkout checks it again with her email and DNI.
export async function POST(req: Request) {
  const refused = await cartGuard('code')
  if (refused) return refused
  const body = (await readJson(req)) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? normalizeCode(body.code).slice(0, 40) : ''
  const { cartId } = await browserCart({ create: code.length > 0, write: true })
  if (!code || !cartId) return cartJson(cartId, { error: COUPON_ERRORS.unknown, status: 400 })
  const db = getDb()
  await setCoupon(db, cartId, code)
  const s = await getSettings()
  const view = await viewCart(db, await findCartById(db, cartId), { capPct: s['commerce.discountCapPct'] })
  if (view.couponError) {
    await setCoupon(db, cartId, null)
    return cartJson(cartId, { error: view.couponError, status: 400 })
  }
  return cartJson(cartId, { message: `Código ${code} aplicado.` })
}

export async function DELETE() {
  const refused = await cartGuard('write')
  if (refused) return refused
  const { cartId } = await browserCart({ create: false, write: true })
  if (cartId) await setCoupon(getDb(), cartId, null)
  return cartJson(cartId)
}
