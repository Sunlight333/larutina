'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { bool, fail, fromZod, int, moneyCents, ok, optStr, str, type FormState } from '@/server/admin/forms'
import { couponSchema, deleteCoupon, saveCoupon } from '@/server/services/admin/commerce/settings'

const date = (form: FormData, name: string) => {
  const v = str(form, name)
  if (!v) return null
  const d = new Date(`${v}T00:00:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function saveCouponAction(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('commerce.settings')
  const kind = str(form, 'kind') === 'AMOUNT' ? 'AMOUNT' : 'PERCENT'
  const value = kind === 'AMOUNT' ? moneyCents(form, 'value') : int(form, 'value')
  const endsAt = date(form, 'endsAt')
  const parsed = couponSchema.safeParse({
    code: str(form, 'code'),
    kind,
    value: value ?? undefined,
    description: optStr(form, 'description'),
    startsAt: date(form, 'startsAt'),
    // Valid through the whole last day, Buenos Aires time.
    endsAt: endsAt ? new Date(endsAt.getTime() + 24 * 3_600_000 - 1) : null,
    minSubtotalCents: moneyCents(form, 'minSubtotal'),
    maxUses: int(form, 'maxUses'),
    firstPurchaseOnly: bool(form, 'firstPurchaseOnly'),
    combinesWithTransfer: bool(form, 'combinesWithTransfer'),
    active: bool(form, 'active'),
  })
  if (!parsed.success) return fromZod(parsed.error)
  const r = await saveCoupon(getDb(), admin, id, parsed.data)
  if (!r.ok) return fail(r.error, { code: r.error })
  revalidatePath('/admin/cupones')
  if (!id) redirect(`/cupones/${r.id}`)
  return ok()
}

export async function deleteCouponAction(id: string): Promise<FormState> {
  const admin = await requireAdmin('commerce.settings')
  await deleteCoupon(getDb(), admin, id)
  revalidatePath('/admin/cupones')
  redirect('/cupones')
}
