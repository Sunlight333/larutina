'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { audit } from '@/server/audit'
import { fail, files, ok, str, type FormState } from '@/server/admin/forms'
import { DocumentError, saveDocument } from '@/server/documents'

export async function addMaterialAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  const title = str(form, 'title')
  const url = str(form, 'url')
  const [file] = await files(form, 'file')
  if (!title) return fail('Escribí el título.', { title: 'Este dato es obligatorio.' })
  if (!file && !/^https?:\/\//.test(url)) return fail('Poné un link que empiece con https:// o subí un archivo.')
  const db = getDb()
  try {
    const asset = file ? await saveDocument(db, file, { createdBy: admin.email, folder: 'material' }) : null
    const position = await db.ambassadorMaterial.count()
    const m = await db.ambassadorMaterial.create({ data: { title, kind: asset ? 'file' : 'link', url: asset ? null : url, fileKey: asset?.key ?? null, fileName: asset?.fileName ?? null, position } })
    await audit(db, admin, { action: 'create', entityType: 'AmbassadorMaterial', entityId: m.id, label: title })
  } catch (e) {
    if (e instanceof DocumentError) return fail(e.message)
    throw e
  }
  revalidatePath('/admin/embajadoras/material')
  return ok('Agregado.')
}

export async function deleteMaterialAction(id: string): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  const m = await getDb().ambassadorMaterial.delete({ where: { id } })
  await audit(getDb(), admin, { action: 'delete', entityType: 'AmbassadorMaterial', entityId: id, label: m.title })
  revalidatePath('/admin/embajadoras/material')
  return ok('Sacado.')
}
