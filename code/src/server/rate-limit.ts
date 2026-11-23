// In-memory fixed-window limiter. One app container serves the site, so a
// process-local counter is enough; it resets on deploy, which is acceptable
// for brute-force and spam protection (INF-05).

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) prune(now)
    return { ok: true, retryAfterMs: 0 }
  }
  bucket.count++
  return bucket.count > limit ? { ok: false, retryAfterMs: bucket.resetAt - now } : { ok: true, retryAfterMs: 0 }
}

function prune(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
}
