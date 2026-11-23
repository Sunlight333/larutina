'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { unsubscribeNewsletter } from '@/server/services/content/subscribers'

export async function unsubscribeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('subscribers.export')
  const email = str(form, 'email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Revisá el email.', { email: 'El email no es válido.' })
  const result = await unsubscribeNewsletter(getDb(), admin, email)
  revalidatePath('/admin/suscriptores')
  if (result === 'missing') return fail('Ese email no está en el newsletter.', { email: 'No está suscripto.' })
  return ok(result === 'already' ? 'Ya estaba dado de baja.' : 'Dado de baja.')
}
