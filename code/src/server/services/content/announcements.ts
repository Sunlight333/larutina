import type { Announcement, PrismaClient } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import type { CopyVariables } from '@/lib/copy-variables'
import { ContentError } from './errors'
import { linkProblem } from './fields'

// The rotating announcement bar (NAV-01, G-01): messages with an order, an
// on/off switch and optional start and end dates. The site shows the active
// ones in their window (src/server/services/site.ts getAnnouncements); a
// message that uses a variable without a value, such as
// {envio_gratis_desde} before the threshold is set, is hidden on its own.

/** "2026-12-01T09:00" typed in the panel is Buenos Aires time (UTC−3, no daylight saving). */
export function fromArgentinaInput(value: string): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN)
  return new Date(`${value}:00-03:00`)
}

export function toArgentinaInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16)
}

export type AnnouncementInput = { text: string; href: string; startsAt: string; endsAt: string; active: boolean }

export function parseAnnouncement(input: AnnouncementInput) {
  const errors: Record<string, string> = {}
  const text = input.text.trim()
  if (!text) errors.text = 'Escribí el mensaje.'
  else if (text.length > 160) errors.text = `Hasta 160 caracteres (tiene ${text.length}).`
  const href = input.href.trim()
  const lp = linkProblem(href)
  if (lp) errors.href = lp
  const startsAt = fromArgentinaInput(input.startsAt)
  const endsAt = fromArgentinaInput(input.endsAt)
  if (startsAt && Number.isNaN(startsAt.getTime())) errors.startsAt = 'La fecha no es válida.'
  if (endsAt && Number.isNaN(endsAt.getTime())) errors.endsAt = 'La fecha no es válida.'
  if (startsAt && endsAt && !errors.startsAt && !errors.endsAt && endsAt <= startsAt) errors.endsAt = 'Tiene que ser posterior al inicio.'
  return { data: { text, href: href || null, startsAt, endsAt, active: input.active }, errors }
}

export type AnnouncementState = 'visible' | 'scheduled' | 'expired' | 'inactive' | 'waiting-value'

/** Why a message is or is not on the site right now. */
export function announcementState(a: Pick<Announcement, 'active' | 'startsAt' | 'endsAt' | 'text'>, vars: CopyVariables, now = new Date()): { state: AnnouncementState; missing: string[] } {
  const missing = [...a.text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]!).filter((name) => {
    const v = vars[name]
    return v === undefined || v === '' || v === 0
  })
  if (!a.active) return { state: 'inactive', missing }
  if (a.startsAt && a.startsAt > now) return { state: 'scheduled', missing }
  if (a.endsAt && a.endsAt <= now) return { state: 'expired', missing }
  return { state: missing.length ? 'waiting-value' : 'visible', missing }
}

const snapshot = (a: Announcement) => ({ text: a.text, href: a.href, startsAt: a.startsAt?.toISOString() ?? null, endsAt: a.endsAt?.toISOString() ?? null, active: a.active })

export async function createAnnouncement(db: PrismaClient, actor: Actor, input: AnnouncementInput) {
  const { data, errors } = parseAnnouncement(input)
  if (Object.keys(errors).length) return { errors }
  const last = await db.announcement.findFirst({ orderBy: { position: 'desc' } })
  await db.$transaction(async (tx) => {
    const a = await tx.announcement.create({ data: { ...data, position: (last?.position ?? -1) + 1 } })
    await audit(tx, actor, { action: 'create', entityType: 'Announcement', entityId: a.id, label: a.text, after: snapshot(a) })
  })
  return { errors: {} }
}

export async function updateAnnouncement(db: PrismaClient, actor: Actor, id: string, input: AnnouncementInput) {
  const { data, errors } = parseAnnouncement(input)
  if (Object.keys(errors).length) return { errors, changed: false }
  const changed = await db.$transaction(async (tx) => {
    const before = await tx.announcement.findUnique({ where: { id } })
    if (!before) throw new ContentError('El anuncio ya no existe.')
    const after = await tx.announcement.update({ where: { id }, data })
    const diff = changedFields(snapshot(before), snapshot(after))
    if (diff.changed) await audit(tx, actor, { action: 'update', entityType: 'Announcement', entityId: id, label: after.text, before: diff.before, after: diff.after })
    return diff.changed
  })
  return { errors: {}, changed }
}

/** Swaps a message with its neighbour; positions are renumbered 0..n so the order stays clean. */
export async function moveAnnouncement(db: PrismaClient, actor: Actor, id: string, direction: -1 | 1) {
  await db.$transaction(async (tx) => {
    const rows = await tx.announcement.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
    const i = rows.findIndex((r) => r.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= rows.length) return
    ;[rows[i], rows[j]] = [rows[j]!, rows[i]!]
    for (const [position, r] of rows.entries()) if (r.position !== position) await tx.announcement.update({ where: { id: r.id }, data: { position } })
    await audit(tx, actor, { action: 'reorder', entityType: 'Announcement', entityId: id, label: rows[j]!.text, after: { position: j } })
  })
}

export async function deleteAnnouncement(db: PrismaClient, actor: Actor, id: string) {
  await db.$transaction(async (tx) => {
    const a = await tx.announcement.findUnique({ where: { id } })
    if (!a) return
    await tx.announcement.delete({ where: { id } })
    await audit(tx, actor, { action: 'delete', entityType: 'Announcement', entityId: id, label: a.text, before: snapshot(a) })
  })
}
