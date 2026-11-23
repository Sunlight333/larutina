import { PrismaClient } from '@prisma/client'

// One client per server instance; survives hot reload in development.
// Created on first use, so pages that never touch the database (the demo
// storefront) build and run without DATABASE_URL.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}
