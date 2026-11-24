import { NextResponse } from 'next/server'

// EB-13: the short link /r/CODE is the same as ?ref=CODE on the Home.
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params
  const clean = code.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30)
  return NextResponse.redirect(new URL(clean ? `/?ref=${encodeURIComponent(clean)}` : '/', req.url), 302)
}
