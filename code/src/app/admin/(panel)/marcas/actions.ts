'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, str, type FormState } from '@/server/admin/forms'
import { readImageField, UploadError } from '@/server/admin/media-field'
import { deleteBrand, saveBrand } from '@/server/services/admin/catalog/taxonomies'

async function read(form: FormData, email: string) {
  try {
    return { input: { code: str(form, 'code'), name: str(form, 'name'), countryOfOrigin: str(form, 'countryOfOrigin'), description: str(form, 'description'), logoFile: await readImageField(getDb(), form, 'logoFile', email) } }
  } catch (e) {
    if (e instanceof UploadError) return { error: fail(e.message, { logoFile: e.message }) }
    throw e
  }
}

export async function createBrandAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const r = await read(form, admin.email)
  if ('error' in r) return r.error ?? null
  const result = await saveBrand(getDb(), admin, null, r.input)
  if (!result.ok) return result
  revalidatePath('/admin/marcas')
  redirect(`/admin/marcas/${result.code}`)
}

export async function updateBrandAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const r = await read(form, admin.email)
  if ('error' in r) return r.error ?? null
  const result = await saveBrand(getDb(), admin, code, r.input)
  revalidatePath('/admin/marcas')
  revalidatePath('/', 'layout')
  return result
}

export async function deleteBrandAction(code: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteBrand(getDb(), admin, code)
  if (!result.ok) return result
  revalidatePath('/admin/marcas')
  redirect('/admin/marcas?borrada=1')
}
