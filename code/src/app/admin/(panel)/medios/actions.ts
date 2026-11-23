'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, files, ok, str, type FormState } from '@/server/admin/forms'
import { deleteMedia, updateMediaAlt, uploadMedia } from '@/server/services/content/media-library'

export async function uploadMediaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('media.manage')
  const list = await files(form, 'files')
  if (!list.length) return fail('Elegí una o más imágenes.', { files: 'Elegí una o más imágenes.' })
  const { saved, problems } = await uploadMedia(getDb(), admin, list)
  revalidatePath('/admin/medios')
  if (problems.length) return fail(`${saved.length ? `Se subieron ${saved.length}. ` : ''}${problems.join(' ')}`)
  return ok(saved.length === 1 ? 'Imagen subida.' : `Se subieron ${saved.length} imágenes.`)
}

export async function saveMediaAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('media.manage')
  if (str(form, 'intent') === 'delete') {
    await deleteMedia(getDb(), admin, id)
    revalidatePath('/admin/medios')
    return ok('Imagen en la papelera.')
  }
  await updateMediaAlt(getDb(), admin, id, str(form, 'alt'))
  revalidatePath('/admin/medios')
  return ok('Guardado.')
}
