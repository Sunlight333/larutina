'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { moderateReview } from '@/server/services/admin/commerce/settings'

export async function moderateAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('reviews.moderate')
  const status = str(form, 'status')
  if (status !== 'APPROVED' && status !== 'REJECTED') return fail('Acción desconocida.')
  const r = await moderateReview(getDb(), admin, id, status)
  revalidatePath('/admin/resenas')
  // The product page shows the new count and average.
  revalidatePath('/producto/[code]', 'page')
  return ok(status === 'APPROVED' ? `Publicada en ${r.product.name}.` : 'Rechazada.')
}
