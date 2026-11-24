import { getDb } from '@/server/db'
import { importLegacyLines } from '@/server/commerce/cart-access'
import { browserCart, cartGuard, cartJson, readJson } from '@/server/commerce/cart-cookie'

// POST /api/cart/import { lines: [{ sku, qty }] }: once per browser, the
// Phase 1 cart kept in localStorage moves to the server cart; the browser
// then forgets it. SKUs already in the cart are left alone, so a repeat is harmless.
export async function POST(req: Request) {
  const refused = await cartGuard('write')
  if (refused) return refused
  const body = (await readJson(req)) as { lines?: unknown } | null
  const lines: unknown[] = Array.isArray(body?.lines) ? body.lines : []
  const { cartId } = await browserCart({ create: lines.length > 0, write: true })
  if (cartId && lines.length) await importLegacyLines(getDb(), cartId, lines)
  return cartJson(cartId)
}
