'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { bool, fail, ok, str, type FormState } from '@/server/admin/forms'
import { createAnnouncement, deleteAnnouncement, moveAnnouncement, updateAnnouncement, type AnnouncementInput } from '@/server/services/content/announcements'

const input = (form: FormData): AnnouncementInput => ({ text: str(form, 'text'), href: str(form, 'href'), startsAt: str(form, 'startsAt'), endsAt: str(form, 'endsAt'), active: bool(form, 'active') })

const done = () => {
  revalidatePath('/admin/anuncios')
  revalidatePath('/', 'layout')
}

export async function createAnnouncementAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const { errors } = await createAnnouncement(getDb(), admin, input(form))
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  done()
  return ok('Anuncio creado.')
}

export async function updateAnnouncementAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const { errors, changed } = await updateAnnouncement(getDb(), admin, id, input(form))
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  done()
  return ok(changed ? 'Anuncio guardado.' : 'No había cambios.')
}

export async function moveAnnouncementAction(form: FormData) {
  const admin = await requireAdmin('content.edit')
  await moveAnnouncement(getDb(), admin, String(form.get('id')), form.get('dir') === 'up' ? -1 : 1)
  done()
}

export async function deleteAnnouncementAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  await deleteAnnouncement(getDb(), admin, id)
  done()
  redirect('/admin/anuncios')
}
