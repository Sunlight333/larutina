'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { str, type FormState } from '@/server/admin/forms'
import { applyChanges, describeChange, parseChanges, previewPercent, previewSheet, previewStatus, readBulkFile, type Preview } from '@/server/services/admin/catalog/bulk'
import type { BulkState } from './types'

function view(preview: Preview): BulkState {
  const rows = preview.changes.flatMap((c) => describeChange(c).map((d) => ({ ...d, row: c.row, product: c.productName })))
  const count = rows.length
  return {
    ok: preview.errors.length === 0 && count > 0,
    message: preview.errors.length
      ? `Hay ${preview.errors.length} ${preview.errors.length === 1 ? 'fila con error' : 'filas con errores'}: corregilas y generá la vista previa de nuevo. No se aplica nada hasta que no haya errores.`
      : count
        ? `${count} ${count === 1 ? 'cambio' : 'cambios'} para revisar.${preview.unchanged ? ` ${preview.unchanged} sin cambios.` : ''}`
        : 'No hay nada para cambiar: los valores ya son esos.',
    rows,
    errors: preview.errors,
    count,
    payload: preview.errors.length || !count ? undefined : JSON.stringify(preview.changes),
    at: Date.now(),
  }
}

export async function previewSheetAction(_prev: BulkState, form: FormData): Promise<BulkState> {
  await requireAdmin('catalog.import')
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Elegí la planilla (.xlsx o .csv).' }
  const read = await readBulkFile(file.name, new Uint8Array(await file.arrayBuffer()))
  if ('error' in read) return { ok: false, message: read.error }
  return view(await previewSheet(getDb(), read.rows))
}

export async function previewPanelAction(_prev: BulkState, form: FormData): Promise<BulkState> {
  await requireAdmin('catalog.import')
  const filters = { brand: str(form, 'marca') || undefined, category: str(form, 'categoria') || undefined, status: str(form, 'estado') || undefined, type: str(form, 'tipo') || undefined }
  const db = getDb()
  if (str(form, 'mode') === 'status') return view(await previewStatus(db, filters, str(form, 'newStatus')))
  const percent = Number(str(form, 'percent').replace(',', '.').replace('%', ''))
  return view(await previewPercent(db, filters, percent))
}

export async function applyBulkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.import')
  const changes = parseChanges(str(form, 'payload'))
  if (!changes) return { ok: false, message: 'La vista previa no es válida: generala de nuevo.' }
  const result = await applyChanges(getDb(), admin, changes)
  if (result.ok) {
    revalidatePath('/admin/productos')
    revalidatePath('/', 'layout')
  }
  return result
}
