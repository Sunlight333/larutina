'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { str, type FormState } from '@/server/admin/forms'
import { deleteIngredient, saveIngredient, setIngredientStatus } from '@/server/services/admin/catalog/ingredients'

const read = (form: FormData) => ({
  code: str(form, 'code'),
  commonName: str(form, 'commonName'),
  inciName: str(form, 'inciName'),
  description: str(form, 'description'),
  familyId: str(form, 'familyId'),
  isKeyActive: str(form, 'isKeyActive'),
  isIrritant: str(form, 'isIrritant'),
})

export async function createIngredientAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveIngredient(getDb(), admin, null, read(form), form.getAll('concernIds').map(String))
  if (!result.ok) return result
  revalidatePath('/admin/ingredientes')
  redirect(`/admin/ingredientes/${result.code}`)
}

export async function updateIngredientAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveIngredient(getDb(), admin, code, read(form), form.getAll('concernIds').map(String))
  revalidatePath('/admin/ingredientes')
  revalidatePath('/', 'layout')
  return result
}

/** "Marcar como revisado" (or back to review), from the list or the edit page. */
export async function reviewIngredientAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await setIngredientStatus(getDb(), admin, code, str(form, 'status') === 'REVIEW' ? 'REVIEW' : 'ACTIVE')
  revalidatePath('/admin/ingredientes')
  revalidatePath(`/admin/ingredientes/${code}`)
  return result
}

export async function deleteIngredientAction(code: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteIngredient(getDb(), admin, code)
  if (!result.ok) return result
  revalidatePath('/admin/ingredientes')
  redirect('/admin/ingredientes?borrado=1')
}
