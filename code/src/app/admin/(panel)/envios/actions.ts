'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { bool, fail, fromZod, int, moneyCents, ok, str, type FormState } from '@/server/admin/forms'
import { boxSchema, deleteBox, deleteRate, rateSchema, saveBox, saveRate } from '@/server/services/admin/commerce/settings'

const num = (form: FormData, name: string) => {
  const v = str(form, name).replace(',', '.')
  return v === '' ? undefined : Number(v)
}

export async function saveBoxAction(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('commerce.settings')
  if (str(form, 'do') === 'delete' && id) {
    await deleteBox(getDb(), admin, id)
    revalidatePath('/admin/envios')
    return ok('Caja eliminada.')
  }
  const parsed = boxSchema.safeParse({
    code: str(form, 'code'),
    name: str(form, 'name'),
    heightCm: num(form, 'heightCm'),
    widthCm: num(form, 'widthCm'),
    lengthCm: num(form, 'lengthCm'),
    emptyWeightGrams: int(form, 'emptyWeightGrams') ?? 0,
    maxWeightGrams: int(form, 'maxWeightGrams'),
    isDefault: bool(form, 'isDefault'),
    active: bool(form, 'active'),
  })
  if (!parsed.success) return fromZod(parsed.error)
  const r = await saveBox(getDb(), admin, id, parsed.data)
  if (!r.ok) return fail(r.error, { code: r.error })
  revalidatePath('/admin/envios')
  return ok(id ? 'Guardado.' : 'Caja agregada.')
}

export async function saveRateAction(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('commerce.settings')
  if (str(form, 'do') === 'delete' && id) {
    await deleteRate(getDb(), admin, id)
    revalidatePath('/admin/envios')
    return ok('Tarifa eliminada.')
  }
  const parsed = rateSchema.safeParse({
    zone: str(form, 'zone'),
    provinces: form.getAll('provinces').map(String),
    carrier: str(form, 'carrier'),
    priceCents: moneyCents(form, 'price') ?? undefined,
    minDays: int(form, 'minDays') ?? undefined,
    maxDays: int(form, 'maxDays') ?? undefined,
    position: int(form, 'position') ?? 0,
    active: bool(form, 'active'),
  })
  if (!parsed.success) return fromZod(parsed.error)
  await saveRate(getDb(), admin, id, parsed.data)
  revalidatePath('/admin/envios')
  return ok(id ? 'Guardado.' : 'Tarifa agregada.')
}
