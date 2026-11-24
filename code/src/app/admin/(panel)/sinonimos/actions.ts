'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { str, type FormState } from '@/server/admin/forms'
import { deleteSynonym, saveSynonym } from '@/server/services/admin/catalog/synonyms'

const read = (form: FormData) => ({ term: str(form, 'term'), type: str(form, 'type'), targetCode: str(form, 'targetCode'), variants: str(form, 'variants') })

export async function createSynonymAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveSynonym(getDb(), admin, null, read(form))
  revalidatePath('/admin/sinonimos')
  return result
}

export async function updateSynonymAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveSynonym(getDb(), admin, id, read(form))
  revalidatePath('/admin/sinonimos')
  return result
}

export async function deleteSynonymAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteSynonym(getDb(), admin, id)
  if (!result.ok) return result
  revalidatePath('/admin/sinonimos')
  redirect('/sinonimos?borrado=1')
}
