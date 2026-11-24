'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, int, ok, str, type FormState } from '@/server/admin/forms'
import { adjustVariantStock } from '@/server/services/admin/commerce/settings'

export async function adjustStockAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('stock.adjust')
  const delta = int(form, 'delta')
  const r = await adjustVariantStock(getDb(), admin, str(form, 'sku').toUpperCase(), delta ?? NaN, str(form, 'note'))
  if (!r.ok) return fail(r.error)
  revalidatePath('/admin/stock')
  return ok(`Listo: quedan ${r.stock}.`)
}
