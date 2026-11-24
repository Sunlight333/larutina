import { randomBytes } from 'node:crypto'
import type { MediaAsset, PrismaClient } from '@prisma/client'
import { storage } from '@/server/storage'

// Private documents: an image or a PDF (an ambassador's licence, material for
// ambassadors, a transfer receipt). Checked by content, not only by the type
// the browser declares, and stored under private/ (02 §6).

export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export class DocumentError extends Error {}

function sniff(data: Buffer): (typeof DOCUMENT_TYPES)[number] | null {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

const safeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'archivo'

export async function saveDocument(db: PrismaClient, file: { name: string; type: string; data: Buffer }, opts: { createdBy?: string; folder: string }): Promise<MediaAsset> {
  if (file.data.length > MAX_DOCUMENT_BYTES) throw new DocumentError(`"${file.name}" pesa más de 10 MB.`)
  const type = sniff(file.data)
  if (!type) throw new DocumentError(`"${file.name}": subí una foto (JPG, PNG o WebP) o un PDF.`)
  const fileName = safeName(file.name)
  const key = `private/${opts.folder}/${new Date().toISOString().slice(0, 7)}/${randomBytes(6).toString('hex')}-${fileName}`
  await storage().put(key, file.data, type)
  return db.mediaAsset.create({ data: { key, visibility: 'PRIVATE', fileName, mimeType: type, size: file.data.length, createdBy: opts.createdBy } })
}
