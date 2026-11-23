import type { PrismaClient } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import { ContentError } from './errors'

// Versioned legal texts (CMS-04, IR-29). The panel edits a draft; "Publicar
// versión" adds version n+1 and every earlier version stays, with its date
// and who published it, so the site can always show what applied when.

export const LEGAL_DOCUMENTS = [
  { code: 'terminos', title: 'Términos y condiciones' },
  { code: 'privacidad', title: 'Política de privacidad' },
  { code: 'cambios-y-devoluciones', title: 'Cambios y devoluciones' },
  { code: 'cookies', title: 'Política de cookies' },
  { code: 'programa-embajadoras', title: 'Términos del programa de embajadoras' },
] as const

export async function listLegalDocuments(db: PrismaClient) {
  const docs = await db.legalDocument.findMany({ orderBy: { createdAt: 'asc' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
  return docs.map((d) => {
    const latest = d.versions[0] ?? null
    return { ...d, latest, pendingChanges: !latest || latest.body !== d.draftBody || latest.title !== d.title }
  })
}

export async function saveLegalDraft(db: PrismaClient, actor: Actor, id: string, input: { title: string; draftBody: string }) {
  const title = input.title.trim()
  if (!title) throw new ContentError('Escribí el título.', 'title')
  if (title.length > 160) throw new ContentError('Hasta 160 caracteres.', 'title')
  return db.$transaction(async (tx) => {
    const doc = await tx.legalDocument.findUniqueOrThrow({ where: { id } })
    const diff = changedFields({ title: doc.title, draftBody: doc.draftBody }, { title, draftBody: input.draftBody })
    if (!diff.changed) return false
    await tx.legalDocument.update({ where: { id }, data: { title, draftBody: input.draftBody } })
    await audit(tx, actor, { action: 'update', entityType: 'LegalDocument', entityId: id, label: title, before: diff.before, after: diff.after })
    return true
  })
}

/** Publishes the draft as the next version; the earlier ones are kept as they were. */
export async function publishLegalVersion(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.legalDocument.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
    if (!doc.draftBody.trim()) throw new ContentError('El texto está vacío.', 'draftBody')
    const latest = doc.versions[0]
    if (latest && latest.body === doc.draftBody && latest.title === doc.title) throw new ContentError('No hay cambios desde la última versión publicada.')
    const version = await tx.legalVersion.create({
      data: { documentId: id, version: (latest?.version ?? 0) + 1, title: doc.title, body: doc.draftBody, publishedBy: actor?.email ?? null },
    })
    await audit(tx, actor, { action: 'publish', entityType: 'LegalDocument', entityId: id, label: `${doc.title} v${version.version}`, after: { version: version.version } })
    return version
  })
}

/** The version in force and the list of all of them, newest first. */
export async function getLegalForSite(db: PrismaClient, code: string) {
  const doc = await db.legalDocument.findUnique({ where: { code }, include: { versions: { orderBy: { version: 'desc' } } } })
  if (!doc || !doc.versions.length) return null
  return { doc, current: doc.versions[0]!, versions: doc.versions }
}

export async function getLegalVersion(db: PrismaClient, code: string, version: number) {
  if (!Number.isInteger(version) || version < 1) return null
  const doc = await db.legalDocument.findUnique({ where: { code }, include: { versions: { orderBy: { version: 'desc' } } } })
  const v = doc?.versions.find((x) => x.version === version)
  if (!doc || !v) return null
  return { doc, version: v, current: doc.versions[0]!, isCurrent: doc.versions[0]!.version === version }
}
