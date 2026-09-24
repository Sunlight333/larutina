import { PrismaClient } from '@prisma/client'

// Database URL resolution. DATABASE_URL / DIRECT_URL are the names in the
// README; the others are what Vercel's Neon integration creates, so either
// setup works without renaming anything.
const POOLED = ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']
const DIRECT = ['DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']

const firstSet = (names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim() !== '')

const url = firstSet(POOLED)

/** True when a PostgreSQL database is configured. */
export const usingDatabase = Boolean(url)

// One client per server instance; survives hot reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * The Prisma client, or null when no database is configured. Without one the
 * demo runs on the sample catalog bundled in prisma/seed/data.ts and result
 * links carry the answers (see src/lib/diagnosis/answers.ts), so a deploy
 * works before the database exists. Connecting one needs no code change.
 */
export const db: PrismaClient | null = url ? (globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: url })) : null

if (url) {
  // The schema reads both variables; fill them from whichever names were found.
  process.env.DATABASE_URL ||= url
  process.env.DIRECT_URL ||= firstSet(DIRECT) ?? url
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db!
} else if (process.env.NEXT_PHASE === 'phase-production-build') {
  // Names only, never values: tells the build log what Vercel provided.
  const present = Object.keys(process.env)
    .filter((k) => /DATABASE|POSTGRES|NEON|^PG/.test(k))
    .sort()
  console.warn(
    `[larutina] No database URL found (${POOLED.join(', ')}). Building on the bundled sample catalog; ` +
      `diagnosis results are encoded in their links. Database-related variables visible: ${present.join(', ') || 'none'}.`,
  )
}
