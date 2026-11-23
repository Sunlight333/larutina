import { NextResponse } from 'next/server'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { getSearchProvider, type SuggestResult } from '@/server/search'
import { catalogViewer } from '@/server/services/catalog/viewer'

// GET /api/search/suggest?q=: autocomplete grouped by type (NAV-06, G-04).
// Returns nothing while the site is closed to the visitor, so the catalog
// cannot be read through the API before launch.
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  const empty: SuggestResult = { query: q, groups: [], seeAll: null }
  if (q.length < 2 || !(await catalogViewer()).canSee) return NextResponse.json(empty, { headers })
  // Generous: the box asks once per pause while typing.
  if (!rateLimit(`suggest:${await clientIp()}`, 240, 60_000).ok) return NextResponse.json(empty, { status: 429, headers })
  return NextResponse.json(await getSearchProvider().suggest(q), { headers })
}
