import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { getPreviewToken, PREVIEW_COOKIE } from '@/server/site-access'

// Opens the site for whoever has the preview link while it is in waitlist or
// maintenance mode. Rotating the link in the panel closes every old one.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('t') ?? ''
  const valid = token.length > 0 && token === (await getPreviewToken(getDb()))
  const jar = await cookies()
  if (valid) {
    jar.set(PREVIEW_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  } else if (url.searchParams.has('salir')) {
    jar.delete(PREVIEW_COOKIE)
  }
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? url.origin), 303)
}
