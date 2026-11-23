import type { PrismaClient } from '@prisma/client'
import { audit, type Actor } from '@/server/audit'

// The waitlist (GEN-08) and newsletter (G-17) lists, as CSV for the email
// tool. UTF-8 with a byte order mark so Excel reads the accents; cells that
// start like a formula are prefixed so a spreadsheet never runs them.

const BOM = '﻿'

function cell(v: string | null | undefined): string {
  let s = v ?? ''
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: (string | null | undefined)[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

const art = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
/** "2026-11-23 18:05", Buenos Aires time: sorts well and Excel reads it as a date. */
export const csvDate = (d: Date | null) => (d ? art.format(d) : '')

export async function subscriberCounts(db: PrismaClient) {
  const [waitlist, waitlistNew, newsletter, unsubscribed] = await Promise.all([
    db.waitlistSignup.count(),
    db.waitlistSignup.count({ where: { exportedAt: null } }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
  ])
  return { waitlist, waitlistNew, newsletter, unsubscribed }
}

/** The waitlist as CSV; the exported rows are marked, so the next export can bring only the new ones. */
export async function exportWaitlist(db: PrismaClient, actor: Actor, opts: { onlyNew: boolean; now?: Date }) {
  const now = opts.now ?? new Date()
  return db.$transaction(async (tx) => {
    const rows = await tx.waitlistSignup.findMany({ where: opts.onlyNew ? { exportedAt: null } : {}, orderBy: { createdAt: 'asc' } })
    const csv = toCsv(
      ['email', 'fecha_alta', 'consentimiento', 'exportado_antes'],
      rows.map((r) => [r.email, csvDate(r.createdAt), r.consentText, csvDate(r.exportedAt)]),
    )
    const fresh = rows.filter((r) => !r.exportedAt).map((r) => r.id)
    if (fresh.length) await tx.waitlistSignup.updateMany({ where: { id: { in: fresh } }, data: { exportedAt: now } })
    await audit(tx, actor, { action: 'export', entityType: 'WaitlistSignup', label: opts.onlyNew ? 'Lista de espera (solo nuevos)' : 'Lista de espera', after: { rows: rows.length, newlyMarked: fresh.length } })
    return { csv, count: rows.length }
  })
}

/** Active newsletter subscribers only: an unsubscribed email never goes back to the email tool. */
export async function exportNewsletter(db: PrismaClient, actor: Actor) {
  const rows = await db.newsletterSubscriber.findMany({ where: { unsubscribedAt: null }, orderBy: { createdAt: 'asc' } })
  const csv = toCsv(['email', 'fecha_alta', 'origen', 'consentimiento'], rows.map((r) => [r.email, csvDate(r.createdAt), r.source, r.consentText]))
  await audit(db, actor, { action: 'export', entityType: 'NewsletterSubscriber', label: 'Newsletter', after: { rows: rows.length } })
  return { csv, count: rows.length }
}

export async function unsubscribeNewsletter(db: PrismaClient, actor: Actor, email: string) {
  const e = email.trim().toLowerCase()
  return db.$transaction(async (tx) => {
    const sub = await tx.newsletterSubscriber.findUnique({ where: { email: e } })
    if (!sub) return 'missing' as const
    if (sub.unsubscribedAt) return 'already' as const
    await tx.newsletterSubscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: new Date() } })
    await audit(tx, actor, { action: 'unsubscribe', entityType: 'NewsletterSubscriber', entityId: sub.id, label: e })
    return 'done' as const
  })
}
