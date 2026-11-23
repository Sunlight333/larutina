import type { ContactStatus, PrismaClient } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import { saveUpload, UploadError, type UploadInput } from '@/server/media'

// The contact form (CMS-03, AY-01 to AY-04): a reason, the contact details,
// the message and up to four photos, for a damaged or wrong product. Photos
// are private media: only the panel shows them, through a route that checks
// the permission and records each view.

export const CONTACT_REASONS = ['Consulta sobre un producto', 'Estado de mi pedido', 'Producto dañado o incorrecto', 'Cambios y devoluciones', 'Otro'] as const
export const MAX_PHOTOS = 4
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
// The phone's camera roll is sent as JPEG by the browser, so HEIC never reaches here.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export const STATUS_LABELS: Record<ContactStatus, string> = { NEW: 'Nuevo', IN_PROGRESS: 'En curso', CLOSED: 'Cerrado' }

export type ContactInput = { reason: string; name: string; email: string; phone: string; orderNumber: string; message: string }

export function validateContact(input: ContactInput, photos: UploadInput[]): Record<string, string> {
  const e: Record<string, string> = {}
  if (!(CONTACT_REASONS as readonly string[]).includes(input.reason)) e.reason = 'Elegí el motivo.'
  if (input.name.length < 2) e.name = 'Escribí tu nombre.'
  else if (input.name.length > 120) e.name = 'Hasta 120 caracteres.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 200) e.email = 'Revisá el email: parece que falta algo.'
  if (input.phone && !/^[+\d][\d\s()-]{5,24}$/.test(input.phone)) e.phone = 'Revisá el teléfono: solo números, espacios y guiones.'
  if (input.orderNumber.length > 40) e.orderNumber = 'Hasta 40 caracteres.'
  if (input.message.length < 10) e.message = 'Contanos un poco más, así te podemos ayudar.'
  else if (input.message.length > 4000) e.message = 'Hasta 4000 caracteres.'
  if (photos.length > MAX_PHOTOS) e.photos = `Hasta ${MAX_PHOTOS} fotos.`
  else {
    const bad = photos.find((p) => !PHOTO_TYPES.includes(p.type))
    const big = photos.find((p) => p.data.length > MAX_PHOTO_BYTES)
    if (bad) e.photos = `"${bad.name}" no es una foto. Usá JPG, PNG o WebP.`
    else if (big) e.photos = `"${big.name}" pesa más de 10 MB.`
  }
  return e
}

/** Stores the message with its photos as private files. Returns the problems by field, if any. */
export async function submitContactMessage(db: PrismaClient, raw: ContactInput, photos: UploadInput[]) {
  const input = { ...raw, email: raw.email.toLowerCase() }
  const errors = validateContact(input, photos)
  if (Object.keys(errors).length) return { errors }
  const keys: string[] = []
  try {
    for (const p of photos) keys.push((await saveUpload(db, p, { visibility: 'PRIVATE', createdBy: input.email })).key)
  } catch (e) {
    if (e instanceof UploadError) return { errors: { photos: e.message } }
    throw e
  }
  const msg = await db.contactMessage.create({
    data: { reason: input.reason, name: input.name, email: input.email, phone: input.phone || null, orderNumber: input.orderNumber || null, message: input.message, attachments: keys },
  })
  return { errors: {} as Record<string, string>, id: msg.id }
}

export async function updateContactMessage(db: PrismaClient, actor: Actor, id: string, input: { status: ContactStatus; note: string }) {
  return db.$transaction(async (tx) => {
    const m = await tx.contactMessage.findUniqueOrThrow({ where: { id } })
    const note = input.note.trim().slice(0, 4000) || null
    const diff = changedFields({ status: m.status, note: m.note }, { status: input.status, note })
    if (!diff.changed) return false
    await tx.contactMessage.update({ where: { id }, data: { status: input.status, note } })
    await audit(tx, actor, { action: 'update', entityType: 'ContactMessage', entityId: id, label: `${m.name} <${m.email}>`, before: diff.before, after: diff.after })
    return true
  })
}

/** An attachment of a message, for the admin-only route. */
export async function getAttachment(db: PrismaClient, id: string, index: number) {
  const m = await db.contactMessage.findUnique({ where: { id }, select: { attachments: true, name: true, email: true } })
  const key = m?.attachments[index]
  if (!m || !key) return null
  const asset = await db.mediaAsset.findUnique({ where: { key } })
  if (!asset || asset.visibility !== 'PRIVATE') return null
  return { message: m, asset }
}
