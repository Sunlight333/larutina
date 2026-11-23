'use server'

import { revalidatePath } from 'next/cache'
import type { ContactStatus } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { STATUS_LABELS, updateContactMessage } from '@/server/services/content/contact'

export async function updateMessageAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('messages.view')
  const status = (Object.keys(STATUS_LABELS) as ContactStatus[]).find((s) => s === str(form, 'status'))
  if (!status) return fail('Elegí un estado.', { status: 'Elegí un estado.' })
  const changed = await updateContactMessage(getDb(), admin, id, { status, note: String(form.get('note') ?? '') })
  revalidatePath('/admin/mensajes')
  return ok(changed ? 'Guardado.' : 'No había cambios.')
}
