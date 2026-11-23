'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { ContentError } from '@/server/services/content/errors'
import { publishLegalVersion, saveLegalDraft } from '@/server/services/content/legal'

export async function saveLegalAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const db = getDb()
  const body = String(form.get('draftBody') ?? '').replace(/\r\n?/g, '\n').trim()
  try {
    const changed = await saveLegalDraft(db, admin, id, { title: str(form, 'title'), draftBody: body })
    if (str(form, 'intent') === 'publish') {
      const v = await publishLegalVersion(db, admin, id)
      revalidatePath('/', 'layout')
      return ok(`Versión ${v.version} publicada. Las anteriores siguen disponibles con su fecha.`)
    }
    revalidatePath(`/admin/legales/${id}`)
    return ok(changed ? 'Borrador guardado. El sitio sigue mostrando la versión publicada.' : 'No había cambios.')
  } catch (e) {
    if (e instanceof ContentError) return fail(e.message, e.field ? { [e.field]: e.message } : undefined)
    throw e
  }
}
