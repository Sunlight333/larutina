import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { getCartItems, MAX_CART_SKUS } from '@/server/services/catalog/cart'
import { catalogViewer } from '@/server/services/catalog/viewer'

// GET /api/cart?sku=A&sku=B: current price and availability of the SKUs in a
// browser cart. Only published products come back, so a cart never shows a
// stale price, a draft or an archived product. Nothing while the site is closed.
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (!(await catalogViewer()).canSee) return NextResponse.json({ items: [] }, { headers })
  if (!rateLimit(`cart:${await clientIp()}`, 120, 60_000).ok) {
    return NextResponse.json({ items: [], error: 'Recibimos muchos pedidos seguidos. Probá de nuevo en un rato.' }, { status: 429, headers })
  }
  const skus = new URL(req.url).searchParams.getAll('sku').slice(0, MAX_CART_SKUS)
  const items = await getCartItems(getDb(), skus)
  return NextResponse.json({ items }, { headers })
}
