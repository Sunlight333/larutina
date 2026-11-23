import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/server/db'

// The site gate (GEN-08, GEN-09), before any page renders. While the site is
// in waitlist or maintenance mode, a visitor who is not the team is rewritten
// to /proximamente, so no storefront page runs for them: a layout can swap
// what is shown, but the page under it still renders and its data would
// travel in the response. "The team" is a signed-in admin with 2FA, or the
// preview link's cookie (same rules as src/server/site-access.ts).
//
// The panel, the APIs (each checks access itself), media and Next's own files
// are outside the matcher.

const SESSION_COOKIE = 'lr_admin'
const PREVIEW_COOKIE = 'lr_preview'
const IDLE_MS = 2 * 60 * 60 * 1000

export async function proxy(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next()
  const db = getDb()
  const rows = await db.setting.findMany({ where: { key: { in: ['site.waitlistMode', 'site.maintenanceMode', 'internal.previewToken'] } } })
  const value = (key: string) => rows.find((r) => r.key === key)?.value
  const maintenance = value('site.maintenanceMode') === true
  const waitlist = value('site.waitlistMode') ?? true // on until launch (settings registry default)
  if (!maintenance && waitlist !== true) return NextResponse.next()

  const preview = request.cookies.get(PREVIEW_COOKIE)?.value
  if (preview && preview === value('internal.previewToken')) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    const session = await db.adminSession.findUnique({
      where: { id: createHash('sha256').update(token).digest('hex') },
      select: { mfaPassed: true, expiresAt: true, lastSeenAt: true, user: { select: { active: true } } },
    })
    const now = Date.now()
    if (session?.mfaPassed && session.user.active && session.expiresAt.getTime() > now && now - session.lastSeenAt.getTime() <= IDLE_MS) {
      return NextResponse.next()
    }
  }

  const url = request.nextUrl.clone()
  url.pathname = '/proximamente'
  url.search = ''
  return NextResponse.rewrite(url, maintenance ? { status: 503, headers: { 'Retry-After': '1800' } } : undefined)
}

export const config = {
  matcher: ['/((?!admin|api/|media/|vista-previa|proximamente|_next/|icon|apple-icon|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)'],
}
