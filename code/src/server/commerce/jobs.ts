// The sweep endpoint's guard and lock (app/api/jobs/sweep). The scheduler
// calls it every minute with `Authorization: Bearer $JOBS_SECRET`; without a
// configured secret nobody can run it. A PostgreSQL advisory lock keeps two
// runs from overlapping when one takes longer than a minute.
import { timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { runSweep } from './sweep'

/** A fixed key for pg_try_advisory_xact_lock: "LRSWEEP" as a number. */
export const SWEEP_LOCK_KEY = 0x4c5253574545

export function jobAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false
  const m = /^Bearer\s+(.+)$/.exec(header ?? '')
  if (!m) return false
  const given = Buffer.from(m[1]!.trim())
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export type SweepCounts = Awaited<ReturnType<typeof runSweep>>

/**
 * Runs the sweep while holding the lock. The lock is transaction-scoped, so it
 * is released however the run ends, even if the process dies; the sweep's own
 * work runs on other connections. Returns null when another run holds it.
 */
export async function runSweepLocked(db: PrismaClient, run: (db: PrismaClient) => Promise<SweepCounts> = runSweep): Promise<SweepCounts | null> {
  return db.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}::bigint) AS locked`
      if (!row?.locked) return null
      return run(db)
    },
    { maxWait: 10_000, timeout: 5 * 60_000 },
  )
}
