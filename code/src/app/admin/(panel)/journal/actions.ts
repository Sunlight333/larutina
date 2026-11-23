'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, int, ok, str, type FormState } from '@/server/admin/forms'
import { ContentError } from '@/server/services/content/errors'
import {
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  publishArticle,
  readArticleForm,
  saveArticleDraft,
  unpublishArticle,
  updateCategory,
} from '@/server/services/content/articles'

const asFormState = (e: unknown): FormState => {
  if (e instanceof ContentError) return fail(e.message, e.field ? { [e.field]: e.message } : undefined)
  throw e
}

export async function createArticleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  let id: string
  try {
    id = (await createArticle(getDb(), admin, { title: str(form, 'title'), slug: str(form, 'slug').toLowerCase() })).id
  } catch (e) {
    return asFormState(e)
  }
  redirect(`/admin/journal/${id}`)
}

export async function saveArticleAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const db = getDb()
  const categories = (await db.articleCategory.findMany({ select: { slug: true } })).map((c) => c.slug)
  const { doc, errors } = await readArticleForm(db, form, categories, admin.email)
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)
  try {
    await saveArticleDraft(db, admin, id, doc, str(form, 'slug').toLowerCase() || undefined)
    if (str(form, 'intent') === 'publish') {
      await publishArticle(db, admin, id)
      revalidatePath('/journal', 'layout')
      return ok('Publicado. El journal ya muestra esta versión.')
    }
    revalidatePath(`/admin/journal/${id}`)
    return ok('Borrador guardado. El sitio no cambia hasta que publiques.')
  } catch (e) {
    return asFormState(e)
  }
}

export async function unpublishArticleAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  await unpublishArticle(getDb(), admin, id)
  revalidatePath('/journal', 'layout')
  return ok('El artículo ya no se ve en el sitio. El borrador se conserva.')
}

export async function deleteArticleAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  await deleteArticle(getDb(), admin, id)
  revalidatePath('/journal', 'layout')
  redirect('/admin/journal?borrado=1')
}

export async function createCategoryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  try {
    await createCategory(getDb(), admin, { name: str(form, 'name'), slug: str(form, 'slug').toLowerCase() })
  } catch (e) {
    return asFormState(e)
  }
  revalidatePath('/admin/journal/categorias')
  return ok('Categoría creada.')
}

export async function updateCategoryAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const position = int(form, 'position')
  try {
    if (str(form, 'intent') === 'delete') await deleteCategory(getDb(), admin, id)
    else await updateCategory(getDb(), admin, id, { name: str(form, 'name'), position: position ?? 0 })
  } catch (e) {
    return asFormState(e)
  }
  revalidatePath('/admin/journal/categorias')
  revalidatePath('/journal', 'layout')
  return ok(str(form, 'intent') === 'delete' ? 'Categoría borrada.' : 'Guardada.')
}
