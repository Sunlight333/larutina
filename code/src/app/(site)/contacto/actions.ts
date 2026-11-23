'use server'

import { getDb } from '@/server/db'
import { files } from '@/server/admin/forms'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { submitContactMessage } from '@/server/services/content/contact'

// CMS-03: the public contact form. A honeypot field and a limit per IP keep
// spam out; photos are stored as private files.

export type ContactState = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null

const text = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

export async function sendContactMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  // A bot fills every field, including the hidden one; it gets a normal answer and nothing is stored.
  if (text(form, 'website')) return { ok: true, message: 'Recibimos tu mensaje.' }
  if (!rateLimit(`contact:${await clientIp()}`, 5, 60 * 60 * 1000).ok) return { ok: false, message: 'Recibimos muchos mensajes desde tu conexión. Probá de nuevo en un rato o escribinos por WhatsApp.' }
  const photos = await files(form, 'photos')
  const result = await submitContactMessage(
    getDb(),
    { reason: text(form, 'reason'), name: text(form, 'name'), email: text(form, 'email'), phone: text(form, 'phone'), orderNumber: text(form, 'orderNumber'), message: text(form, 'message') },
    photos,
  )
  if (Object.keys(result.errors).length) return { ok: false, message: 'Revisá los campos marcados.', fieldErrors: result.errors }
  return { ok: true, message: 'Recibimos tu mensaje.' }
}
