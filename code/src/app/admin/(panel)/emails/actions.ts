'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { restoreEmailTemplate, saveEmailTemplate } from '@/server/services/admin/commerce/settings'

export async function saveEmailAction(key: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('emails.edit')
  if (str(form, 'do') === 'restore') {
    await restoreEmailTemplate(getDb(), admin, key)
    revalidatePath(`/admin/emails/${key}`)
    return ok('Volvió al texto original del archivo de contenidos.')
  }
  const subject = str(form, 'subject')
  const body = str(form, 'body')
  if (!subject) return fail('El asunto es obligatorio.', { subject: 'Este dato es obligatorio.' })
  if (!body) return fail('El cuerpo es obligatorio.', { body: 'Este dato es obligatorio.' })
  await saveEmailTemplate(getDb(), admin, key, { subject, preheader: str(form, 'preheader'), body, ctaLabel: str(form, 'ctaLabel') })
  revalidatePath(`/admin/emails/${key}`)
  return ok('Guardado. Los próximos envíos salen con este texto.')
}
