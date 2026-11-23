'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { PageKind } from '@prisma/client'
import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { newBlock } from '@/server/services/content/blocks'
import { ContentError } from '@/server/services/content/errors'
import { readPageForm } from '@/server/services/content/form'
import { createPage, deletePage, publishPage, savePageDraft, unpublishPage } from '@/server/services/content/pages'
import { seedContent } from '@/server/services/content/seed'

const KINDS: Exclude<PageKind, 'HOME'>[] = ['LANDING', 'INSTITUTIONAL', 'HELP']

const asFormState = (e: unknown): FormState => {
  if (e instanceof ContentError) return fail(e.message, e.field ? { [e.field]: e.message } : undefined)
  throw e
}

export async function createPageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const kind = KINDS.find((k) => k === str(form, 'kind'))
  if (!kind) return fail('Elegí el tipo de página.', { kind: 'Elegí el tipo de página.' })
  let id: string
  try {
    // A landing starts with a hero; the others with a text block, so the editor is never empty.
    const first = kind === 'LANDING' ? newBlock('hero', 'b1', { title: str(form, 'title') }) : newBlock('richText', 'b1', { body: '' })
    const page = await createPage(getDb(), admin, { title: str(form, 'title'), slug: str(form, 'slug').toLowerCase(), kind }, { blocks: [first] })
    id = page.id
  } catch (e) {
    return asFormState(e)
  }
  revalidatePath('/admin/paginas')
  redirect(`/admin/paginas/${id}`)
}

export async function savePageAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const db = getDb()
  const { doc, errors, message } = await readPageForm(db, form, admin.email)
  if (Object.keys(errors).length) return fail(message ?? 'Revisá los campos marcados.', errors)
  const publish = str(form, 'intent') === 'publish'
  try {
    const { changed } = await savePageDraft(db, admin, id, doc)
    if (publish) await publishPage(db, admin, id)
    revalidatePath(`/admin/paginas/${id}`)
    if (publish) {
      revalidatePath('/', 'layout')
      return ok('Publicada. El sitio ya muestra esta versión.')
    }
    return ok(changed ? 'Borrador guardado. El sitio no cambia hasta que publiques.' : 'No había cambios.')
  } catch (e) {
    return asFormState(e)
  }
}

export async function unpublishPageAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  try {
    await unpublishPage(getDb(), admin, id)
  } catch (e) {
    return asFormState(e)
  }
  revalidatePath('/', 'layout')
  return ok('La página ya no se ve en el sitio. El borrador se conserva.')
}

export async function deletePageAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  try {
    await deletePage(getDb(), admin, id)
  } catch (e) {
    return asFormState(e)
  }
  revalidatePath('/', 'layout')
  redirect('/admin/paginas?borrada=1')
}

/** Loads the content file's pages, legal drafts and announcements that are missing; never overwrites. */
export async function seedContentAction(_prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('content.edit')
  const db = getDb()
  const report = await seedContent(db)
  await audit(db, admin, { action: 'seed', entityType: 'Content', label: 'Contenido inicial', after: report })
  revalidatePath('/', 'layout')
  const created = Object.values(report).reduce((n, list) => n + list.length, 0)
  return ok(created ? `Contenido inicial cargado: ${created} elementos nuevos.` : 'Ya estaba todo cargado; no se cambió nada.')
}
