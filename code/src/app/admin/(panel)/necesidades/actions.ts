'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { str, type FormState } from '@/server/admin/forms'
import { deleteConcern, saveConcern } from '@/server/services/admin/catalog/taxonomies'

const read = (form: FormData) => ({
  code: str(form, 'code'),
  name: str(form, 'name'),
  shortLabel: str(form, 'shortLabel'),
  shortDescription: str(form, 'shortDescription'),
  editorialContent: str(form, 'editorialContent'),
})

export async function createConcernAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveConcern(getDb(), admin, null, read(form))
  if (!result.ok) return result
  revalidatePath('/admin/necesidades')
  redirect(`/necesidades/${result.code}`)
}

export async function updateConcernAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveConcern(getDb(), admin, code, read(form))
  revalidatePath('/admin/necesidades')
  revalidatePath('/', 'layout')
  return result
}

export async function deleteConcernAction(code: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteConcern(getDb(), admin, code)
  if (!result.ok) return result
  revalidatePath('/admin/necesidades')
  redirect('/necesidades?borrada=1')
}
