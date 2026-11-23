import { randomBytes } from 'node:crypto'
import type { MediaAsset, MediaVisibility, PrismaClient } from '@prisma/client'
import { storage } from '@/server/storage'

// Uploads (CAT-17, CMS-03). Images are checked and measured with sharp; the
// site serves public files at /media/<key> through next/image, which makes
// the per-screen sizes and AVIF/WebP. Private files never get a public URL.

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const VIDEO_TYPES = ['video/mp4']
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024 // CAT-17
export const PRODUCT_IMAGE_MIN = { width: 1600, height: 2000 } // CAT-17: 4:5, 1600 × 2000 or more

export class UploadError extends Error {}

export type UploadInput = { name: string; type: string; data: Buffer }

export function safeFileName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return (base || 'archivo').slice(-120)
}

export async function saveUpload(
  db: PrismaClient,
  file: UploadInput,
  opts: { visibility: MediaVisibility; createdBy?: string; allowVideo?: boolean; alt?: string },
): Promise<MediaAsset> {
  const isImage = IMAGE_TYPES.includes(file.type)
  const isVideo = opts.allowVideo && VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) throw new UploadError(`"${file.name}": el formato no es válido. Usá JPG, PNG, WebP o AVIF${opts.allowVideo ? ', o MP4 para video' : ''}.`)
  if (isImage && file.data.length > MAX_IMAGE_BYTES) throw new UploadError(`"${file.name}" pesa más de 15 MB.`)
  if (isVideo && file.data.length > MAX_VIDEO_BYTES) throw new UploadError(`"${file.name}" pesa más de 20 MB.`)

  let width: number | null = null
  let height: number | null = null
  if (isImage) {
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(file.data).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      throw new UploadError(`"${file.name}" no se pudo leer como imagen.`)
    }
  }

  const fileName = safeFileName(file.name)
  const key = `${opts.visibility === 'PUBLIC' ? 'public' : 'private'}/${new Date().toISOString().slice(0, 7)}/${randomBytes(6).toString('hex')}-${fileName}`
  await storage().put(key, file.data, file.type)
  return db.mediaAsset.create({
    data: { key, visibility: opts.visibility, fileName, mimeType: file.type, size: file.data.length, width, height, alt: opts.alt, createdBy: opts.createdBy },
  })
}

export const mediaUrl = (key: string) => `/media/${key.split('/').map(encodeURIComponent).join('/')}`

export type ResolvedImage = { src: string; width: number; height: number; alt: string | null }

/**
 * Catalog images are referenced by file name (the template's `imagenes`
 * column) or by key. Missing files resolve to nothing, so a product with an
 * image not uploaded yet shows the placeholder instead of a broken image.
 */
export async function resolveImages(db: PrismaClient, refs: string[]): Promise<Map<string, ResolvedImage>> {
  const wanted = [...new Set(refs.filter(Boolean))]
  if (!wanted.length) return new Map()
  const names = wanted.map(safeFileName)
  const assets = await db.mediaAsset.findMany({
    where: { visibility: 'PUBLIC', deletedAt: null, OR: [{ key: { in: wanted } }, { fileName: { in: names } }] },
    orderBy: { createdAt: 'desc' },
  })
  const out = new Map<string, ResolvedImage>()
  for (const ref of wanted) {
    const a = assets.find((x) => x.key === ref) ?? assets.find((x) => x.fileName === safeFileName(ref))
    if (a) out.set(ref, { src: mediaUrl(a.key), width: a.width ?? 1600, height: a.height ?? 2000, alt: a.alt })
  }
  return out
}
