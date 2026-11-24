'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { audit } from '@/server/audit'
import { fail, int, ok, str, type FormState } from '@/server/admin/forms'
import { ambassadorLeaves, approveAmbassador, rejectAmbassador } from '@/server/ambassadors/program'
import { markPayoutPaid, settleMonth } from '@/server/ambassadors/commissions'
import { loadSettings } from '@/server/settings'

const refresh = () => revalidatePath('/admin/embajadoras', 'layout')

export async function approveAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  const pct = str(form, 'commissionPct')
  const commissionPct = pct ? Number(pct.replace(',', '.')) : null
  if (commissionPct != null && !(commissionPct >= 0 && commissionPct <= 100)) return fail('Revisá el porcentaje.', { commissionPct: 'De 0 a 100.' })
  const discount = int(form, 'customerDiscountPct')
  if (discount != null && (Number.isNaN(discount) || discount < 0 || discount > 100)) return fail('Revisá el descuento.', { customerDiscountPct: 'De 0 a 100.' })
  const r = await approveAmbassador(getDb(), id, { code: str(form, 'code'), commissionPct, customerDiscountPct: discount, cuit: str(form, 'cuit'), payoutAccount: str(form, 'payoutAccount') })
  if (!r.ok) return fail(r.error)
  await audit(getDb(), admin, { action: 'approve', entityType: 'Ambassador', entityId: id, label: r.code, after: { code: r.code, commissionPct, customerDiscountPct: discount } })
  refresh()
  return ok(`Aprobada con el código ${r.code}. Le mandamos el email.`)
}

export async function rejectAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  await rejectAmbassador(getDb(), id, str(form, 'reason'))
  await audit(getDb(), admin, { action: 'reject', entityType: 'Ambassador', entityId: id })
  refresh()
  return ok('Postulación rechazada. Le mandamos el email.')
}

export async function leaveAction(id: string): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  await ambassadorLeaves(getDb(), id)
  await audit(getDb(), admin, { action: 'leave', entityType: 'Ambassador', entityId: id })
  refresh()
  return ok('Dada de baja. Lo aprobado y lo pendiente que se apruebe se le sigue pagando.')
}

export async function noteAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin('ambassadors.manage')
  await getDb().ambassador.update({ where: { id }, data: { note: str(form, 'note') || null } })
  refresh()
  return ok()
}

export async function settleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  try {
    const created = await settleMonth(getDb(), await loadSettings(getDb()), str(form, 'period'), admin.email)
    await audit(getDb(), admin, { action: 'settle', entityType: 'CommissionPayout', label: str(form, 'period'), after: { payouts: created.length } })
    refresh()
    return ok(created.length ? `${created.length} ${created.length === 1 ? 'liquidación creada' : 'liquidaciones creadas'}. Cada embajadora recibió el email.` : 'Nadie llega al mínimo este mes: lo aprobado se suma al próximo.')
  } catch (e) {
    return fail((e as Error).message)
  }
}

export async function payoutPaidAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('ambassadors.manage')
  const invoice = str(form, 'invoice')
  if (!invoice) return fail('Escribí el número de factura.', { invoice: 'Este dato es obligatorio.' })
  const p = await markPayoutPaid(getDb(), id, invoice)
  await audit(getDb(), admin, { action: 'pay', entityType: 'CommissionPayout', entityId: id, label: `${p.period} · ${invoice}` })
  refresh()
  return ok('Marcada como pagada.')
}
