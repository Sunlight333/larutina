import type { Prisma, PrismaClient } from '@prisma/client'

// ADM-03: who changed what and when. Call inside the same transaction as the
// change, so a change is never recorded without happening or the reverse.

export type Actor = { id: string; email: string } | null

export type AuditEntry = {
  action: string
  entityType: string
  entityId?: string | null
  label?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
}

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue))

export async function audit(db: PrismaClient | Prisma.TransactionClient, actor: Actor, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      label: entry.label ?? null,
      before: json(entry.before),
      after: json(entry.after),
      ip: entry.ip ?? null,
    },
  })
}

/** Only the fields that changed, for a compact before/after. */
export function changedFields<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(v)) {
      b[k] = before[k]
      a[k] = v
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 }
}
