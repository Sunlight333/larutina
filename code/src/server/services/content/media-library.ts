import type { MediaAsset, Prisma, PrismaClient } from '@prisma/client'
import { audit, type Actor } from '@/server/audit'
import { PRODUCT_IMAGE_MIN, saveUpload, UploadError, type UploadInput } from '@/server/media'

// The image library (/admin/medios): public images only. Private files
// (contact attachments) never appear here.

export const MAX_FILES_PER_UPLOAD = 20

/** Too small for a product photo (CAT-17: 4:5, 1600 × 2000 or more). */
export function belowProductSize(a: Pick<MediaAsset, 'width' | 'height'>) {
  return a.width != null && a.height != null && (a.width < PRODUCT_IMAGE_MIN.width || a.height < PRODUCT_IMAGE_MIN.height)
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export async function listMedia(db: PrismaClient, opts: { q?: string; skip: number; take: number }) {
  const where: Prisma.MediaAssetWhereInput = {
    visibility: 'PUBLIC',
    deletedAt: null,
    ...(opts.q ? { OR: [{ fileName: { contains: opts.q, mode: 'insensitive' } }, { alt: { contains: opts.q, mode: 'insensitive' } }] } : {}),
  }
  const [rows, total] = await Promise.all([db.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: opts.skip, take: opts.take }), db.mediaAsset.count({ where })])
  return { rows, total }
}

/** Uploads each file on its own: one bad file does not stop the others. */
export async function uploadMedia(db: PrismaClient, actor: Actor, files: UploadInput[]) {
  const saved: MediaAsset[] = []
  const problems: string[] = []
  for (const f of files.slice(0, MAX_FILES_PER_UPLOAD)) {
    try {
      const asset = await saveUpload(db, f, { visibility: 'PUBLIC', createdBy: actor?.email })
      await audit(db, actor, { action: 'upload', entityType: 'MediaAsset', entityId: asset.id, label: asset.fileName, after: { key: asset.key, width: asset.width, height: asset.height } })
      saved.push(asset)
    } catch (e) {
      if (e instanceof UploadError) problems.push(e.message)
      else throw e
    }
  }
  if (files.length > MAX_FILES_PER_UPLOAD) problems.push(`Se subieron las primeras ${MAX_FILES_PER_UPLOAD}; el resto, en otra tanda.`)
  return { saved, problems }
}

export async function updateMediaAlt(db: PrismaClient, actor: Actor, id: string, alt: string) {
  const text = alt.trim().slice(0, 250)
  await db.$transaction(async (tx) => {
    const a = await tx.mediaAsset.findUniqueOrThrow({ where: { id } })
    if ((a.alt ?? '') === text) return
    await tx.mediaAsset.update({ where: { id }, data: { alt: text || null } })
    await audit(tx, actor, { action: 'update', entityType: 'MediaAsset', entityId: id, label: a.fileName, before: { alt: a.alt }, after: { alt: text || null } })
  })
}

/** To the trash bin; the file stays in storage so it can be restored. */
export async function deleteMedia(db: PrismaClient, actor: Actor, id: string) {
  await db.$transaction(async (tx) => {
    const a = await tx.mediaAsset.findUniqueOrThrow({ where: { id } })
    if (a.visibility !== 'PUBLIC') return
    await tx.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'MediaAsset', entityId: id, label: a.fileName })
  })
}
