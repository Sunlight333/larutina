export const dynamic = 'force-dynamic'

// Container liveness for the deploy health check: the app process answers.
// Deliberately independent of the database (see /api/health).
export function GET() {
  return new Response('ok', { headers: { 'Cache-Control': 'no-store' } })
}
