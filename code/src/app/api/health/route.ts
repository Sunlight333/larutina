import { getDb } from '@/server/db'

export const dynamic = 'force-dynamic'

// For uptime monitoring (INF-04): 200 when the app and the database answer.
// The container health check uses /api/live, so a database outage alerts without
// making the deploy roll back an app that is fine.
export async function GET() {
  const started = Date.now()
  try {
    await getDb().$queryRaw`SELECT 1`
    return Response.json({ ok: true, db: 'ok', ms: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false, db: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
