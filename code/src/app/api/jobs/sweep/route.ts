import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { jobAuthorized, runSweepLocked } from '@/server/commerce/jobs'

// POST /api/jobs/sweep: commerce's background work, every minute
// (server/commerce/sweep.ts): expired reservations, reminders, the abandoned
// cart, review requests, back in stock and the email outbox. Only with
// `Authorization: Bearer $JOBS_SECRET`; refused when the secret is not set.
// Runs never overlap (an advisory lock); a call during a run answers 409.
export async function POST(req: Request) {
  if (!jobAuthorized(req.headers.get('authorization'), process.env.JOBS_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const counts = await runSweepLocked(getDb())
  if (!counts) return NextResponse.json({ error: 'a sweep is already running' }, { status: 409 })
  return NextResponse.json(counts, { headers: { 'Cache-Control': 'no-store' } })
}
