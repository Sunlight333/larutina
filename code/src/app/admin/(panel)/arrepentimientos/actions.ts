'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, type FormState } from '@/server/admin/forms'
import { updateWithdrawal, WITHDRAWAL_STATUS } from '@/server/services/admin/commerce/settings'

export async function updateWithdrawalAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.manage')
  const status = (Object.keys(WITHDRAWAL_STATUS) as (keyof typeof WITHDRAWAL_STATUS)[]).find((s) => s === str(form, 'status'))
  if (!status) return fail('Elegí un estado.', { status: 'Elegí un estado.' })
  const changed = await updateWithdrawal(getDb(), admin, id, { status, note: str(form, 'note') })
  revalidatePath('/admin/arrepentimientos')
  return ok(changed ? 'Guardado.' : 'No había cambios.')
}
