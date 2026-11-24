'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { str, type FormState } from '@/server/admin/forms'
import { deleteCategory, saveCategory } from '@/server/services/admin/catalog/taxonomies'

const read = (form: FormData) => ({ code: str(form, 'code'), name: str(form, 'name'), parentId: str(form, 'parentId'), sortOrder: str(form, 'sortOrder'), description: str(form, 'description') })

export async function createCategoryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveCategory(getDb(), admin, null, read(form))
  if (!result.ok) return result
  revalidatePath('/admin/categorias')
  redirect(`/categorias/${result.code}`)
}

export async function updateCategoryAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await saveCategory(getDb(), admin, code, read(form))
  revalidatePath('/admin/categorias')
  revalidatePath('/', 'layout')
  return result
}

export async function deleteCategoryAction(code: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteCategory(getDb(), admin, code)
  if (!result.ok) return result
  revalidatePath('/admin/categorias')
  redirect('/categorias?borrada=1')
}
