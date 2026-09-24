import { PrismaClient } from '@prisma/client'

// Database URL resolution. DATABASE_URL / DIRECT_URL are the names in the
// README; the others are what Vercel's Neon integration creates, so either
// setup works without renaming anything.
const POOLED = ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']
const DIRECT = ['DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']

const firstSet = (names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim() !== '')

const url = firstSet(POOLED)

// Fail loudly (spec §12.2), and say what the build can see. Names only,
// never values.
if (!url) {
  const present = Object.keys(process.env)
    .filter((k) => /DATABASE|POSTGRES|NEON|^PG/.test(k))
    .sort()
  throw new Error(
    `No database URL found: none of ${POOLED.join(', ')} is set to a non-empty value. ` +
      `Database-related variables visible to this build: ${present.length ? present.join(', ') : 'none'}. ` +
      'On Vercel, add DATABASE_URL (Neon pooled URL) and DIRECT_URL (Neon direct URL) under Project → Settings → ' +
      'Environment Variables, ticking Production and Preview, then redeploy.',
  )
}

// The schema reads both variables; fill them from whichever names were found.
process.env.DATABASE_URL ||= url
process.env.DIRECT_URL ||= firstSet(DIRECT) ?? url

// One client per server instance; survives hot reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: url })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
