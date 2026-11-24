import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/server/db'
import { ADMIN_HOST, ADMIN_URL } from '@/lib/hosts'

// Runs before any page renders, and does two jobs.
//
// 1. Hosts (src/lib/hosts.ts). On the panel host (admin.larutinabeauty.com)
//    every path is served from app/admin: /login → /admin/login, / → /admin.
//    Next's files, media and API routes pass through as they are. On the site,
//    /admin/… redirects to the panel host, so old links and bookmarks still
//    work and the panel is never served from the storefront's address.
//
// 2. The maintenance gate (GEN-09), on the site only. While maintenance mode
//    is on, a visitor who is not the team is rewritten to /proximamente, so no
//    storefront page runs for them: a layout can swap what is shown, but the
//    page under it still renders and its data would travel in the response.
//    "The team" is a signed-in admin with 2FA, or the preview link's cookie
//    (same rules as src/server/site-access.ts). Waitlist mode does not close
//    the site: the layout shows the waitlist in a window visitors can skip.

const SESSION_COOKIE = 'lr_admin'
const PREVIEW_COOKIE = 'lr_preview'
const IDLE_MS = 2 * 60 * 60 * 1000

// Served as they are on both hosts.
const SHARED = /^\/(?:_next\/|api\/|media\/|images\/|icon|apple-icon|favicon\.ico$)/
// Outside the maintenance gate: the APIs check access themselves.
const UNGATED = /^\/(?:api\/|media\/|vista-previa|proximamente|_next\/|icon|apple-icon|robots\.txt$|sitemap\.xml$|favicon\.ico$)/

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/')

function requestHost(request: NextRequest): string {
  return (request.headers.get('host') ?? request.nextUrl.host).toLowerCase().replace(/:\d+$/, '')
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (requestHost(request) === ADMIN_HOST) return panel(request)

  if (isAdminPath(pathname)) {
    return NextResponse.redirect(new URL(`${pathname.slice('/admin'.length) || '/'}${search}`, ADMIN_URL), 308)
  }
  if (UNGATED.test(pathname)) return NextResponse.next()
  return maintenanceGate(request)
}

const PANEL_HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

function panel(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/robots.txt') {
    return new NextResponse('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  if (SHARED.test(pathname)) return NextResponse.next({ headers: { 'X-Robots-Tag': 'noindex, nofollow' } })
  // A link that still carries the old prefix: drop it.
  if (isAdminPath(pathname)) {
    return NextResponse.redirect(new URL(`${pathname.slice('/admin'.length) || '/'}${search}`, ADMIN_URL), 308)
  }
  const url = request.nextUrl.clone()
  url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`
  return NextResponse.rewrite(url, { headers: PANEL_HEADERS })
}

async function maintenanceGate(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next()
  const db = getDb()
  const rows = await db.setting.findMany({ where: { key: { in: ['site.maintenanceMode', 'internal.previewToken'] } } })
  const value = (key: string) => rows.find((r) => r.key === key)?.value
  if (value('site.maintenanceMode') !== true) return NextResponse.next()

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
  return NextResponse.rewrite(url, { status: 503, headers: { 'Retry-After': '1800' } })
}

// Everything but Next's static files and image optimizer: the host decides
// what a path means, so the proxy has to see every page request.
export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
