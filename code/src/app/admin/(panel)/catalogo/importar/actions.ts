'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { fail, str, type FormState } from '@/server/admin/forms'
import { applyValidated, importFileProblem, runImport } from '@/server/services/admin/catalog/imports'

export async function importAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.import')
  const upload = form.get('file')
  const file = upload instanceof File && upload.size > 0 ? { name: upload.name, data: new Uint8Array(await upload.arrayBuffer()) } : undefined
  const problem = importFileProblem(file)
  if (problem) return fail(problem, { file: problem })
  const stage = str(form, 'stage') === 'S5' ? 'S5' : 'S1'
  const report = await runImport(getDb(), admin, file!, { stage, dryRun: str(form, 'mode') !== 'importar', canCost: can(admin.role, 'catalog.cost') })
  revalidatePath('/admin/catalogo/importar')
  if (report.status === 'APPLIED') revalidatePath('/', 'layout')
  redirect(`/catalogo/importar/${report.jobId}`)
}

/** "Importar este archivo": the file validated before, validated again and applied. */
export async function applyValidatedAction(jobId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.import')
  const result = await applyValidated(getDb(), admin, jobId, can(admin.role, 'catalog.cost'))
  if ('error' in result) return fail(result.error)
  revalidatePath('/admin/catalogo/importar')
  if (result.status === 'APPLIED') revalidatePath('/', 'layout')
  redirect(`/catalogo/importar/${result.jobId}`)
}
