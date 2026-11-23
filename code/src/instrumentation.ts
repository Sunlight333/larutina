import type { Instrumentation } from 'next'

// Error reporting (INF-04): every unhandled server error is logged as one JSON
// line (docker logs / journal) and, when ALERT_WEBHOOK_URL is set, sent to the
// alert channel, at most once per 10 minutes for the same error so a broken
// page does not flood it. No third-party service, no personal data: only the
// route, the error message and its digest.

const lastSent = new Map<string, number>()
const QUIET_MS = 10 * 60 * 1000

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string }
  const entry = {
    level: 'error',
    at: new Date().toISOString(),
    digest: err.digest,
    message: err.message?.slice(0, 500),
    method: request.method,
    path: request.path.split('?')[0],
    route: context.routePath,
    kind: context.routeType,
  }
  console.error(JSON.stringify(entry))

  const webhook = process.env.ALERT_WEBHOOK_URL
  if (!webhook) return
  const key = `${entry.route}:${entry.message}`
  const now = Date.now()
  if (now - (lastSent.get(key) ?? 0) < QUIET_MS) return
  lastSent.set(key, now)
  const text = `[${process.env.NEXT_PUBLIC_SITE_URL ?? 'larutina'}] Error en ${entry.method} ${entry.route ?? entry.path}: ${entry.message} (digest ${entry.digest ?? '—'})`
  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) })
  } catch {
    // The log line above is the record; a failed alert must not fail the request.
  }
}
