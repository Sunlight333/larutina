import { PrismaClient } from '@prisma/client'

// Fail loudly on a missing database URL (spec §12.2): on Vercel this is the
// usual first-deploy mistake, and Prisma's own error does not say where to fix it.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set or is empty. On Vercel, add DATABASE_URL (Neon pooled URL) and DIRECT_URL (Neon direct URL) ' +
      'under Project → Settings → Environment Variables for Production and Preview, then redeploy.',
  )
}

// One client per server instance; survives hot reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
