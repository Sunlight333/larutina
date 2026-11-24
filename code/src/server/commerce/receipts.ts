// The transfer receipt the customer uploads from her order page (CMP-05,
// CK-08): an image or a PDF, stored as a private file like the contact
// form's photos (only the panel opens it), then attached to the payment.
import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { safeFileName, type UploadInput } from '@/server/media'
import { storage } from '@/server/storage'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const RECEIPT_ACCEPT = [...IMAGE_TYPES, 'application/pdf'].join(',')
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

export async function saveReceipt(db: PrismaClient, file: UploadInput, createdBy: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const isPdf = file.type === 'application/pdf'
  const isImage = IMAGE_TYPES.includes(file.type)
  if (!isPdf && !isImage) return { ok: false, error: `"${file.name}" no es una imagen ni un PDF. Usá JPG, PNG, WebP o PDF.` }
  if (file.data.length > MAX_RECEIPT_BYTES) return { ok: false, error: `"${file.name}" pesa más de 10 MB.` }

  let width: number | null = null
  let height: number | null = null
  if (isPdf) {
    if (file.data.subarray(0, 5).toString('latin1') !== '%PDF-') return { ok: false, error: `"${file.name}" no se pudo leer como PDF.` }
  } else {
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(file.data).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      return { ok: false, error: `"${file.name}" no se pudo leer como imagen.` }
    }
  }

  const fileName = safeFileName(file.name)
  const key = `private/${new Date().toISOString().slice(0, 7)}/${randomBytes(6).toString('hex')}-${fileName}`
  await storage().put(key, file.data, file.type)
  await db.mediaAsset.create({ data: { key, visibility: 'PRIVATE', fileName, mimeType: file.type, size: file.data.length, width, height, createdBy } })
  return { ok: true, key }
}
