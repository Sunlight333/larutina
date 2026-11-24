'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { fail, ok, str, bool, type FormState } from '@/server/admin/forms'
import { OrderStateError } from '@/server/commerce/orders'
import { confirmTransfer, rejectTransferReceipt } from '@/server/commerce/payments'
import { refundOrder, RefundError, type RefundLine } from '@/server/commerce/refunds'
import { OutOfStockError } from '@/server/commerce/stock'
import { CANCEL_REASONS, type CancelReason } from '@/server/email/templates'
import { addNote, cancelUnpaid, markDelivered, markDispatched, saveTracking, startPreparing } from '@/server/services/admin/commerce/orders'

const refresh = (id: string) => {
  revalidatePath('/admin/pedidos')
  revalidatePath(`/admin/pedidos/${id}`)
}

async function attempt(id: string, run: () => Promise<unknown>, done: string): Promise<FormState> {
  try {
    await run()
    refresh(id)
    return ok(done)
  } catch (e) {
    if (e instanceof OrderStateError || e instanceof RefundError) return fail(e.message)
    if (e instanceof OutOfStockError) return fail('Ya no hay stock para volver a reservar este pedido. Reembolsá el pago.')
    console.error('[admin/pedidos]', e)
    return fail('No se pudo guardar. Probá de nuevo.')
  }
}

/** The status buttons: one form, the pressed button says what to do. */
export async function orderStatusAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.manage')
  const db = getDb()
  switch (str(form, 'do')) {
    case 'preparing':
      return attempt(id, () => startPreparing(db, admin, id), 'Pasó a "En preparación".')
    case 'dispatched':
      return attempt(id, () => markDispatched(db, admin, id), 'Marcado como despachado. Le avisamos por email.')
    case 'delivered':
      return attempt(id, () => markDelivered(db, admin, id), 'Marcado como entregado. Le avisamos por email.')
    case 'confirm-transfer':
      return attempt(id, () => confirmTransfer(db, id, admin), 'Transferencia confirmada: el pedido está pagado.')
    default:
      return fail('Acción desconocida.')
  }
}

export async function rejectReceiptAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.manage')
  const note = str(form, 'note')
  if (!note) return fail('Escribí qué no coincide, para el registro.', { note: 'Este dato es obligatorio.' })
  return attempt(id, () => rejectTransferReceipt(getDb(), id, admin, note), 'Comprobante rechazado. Le mandamos un recordatorio con la nueva hora límite.')
}

export async function cancelAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.manage')
  const reason = (Object.keys(CANCEL_REASONS) as CancelReason[]).find((r) => r === str(form, 'reason'))
  if (!reason) return fail('Elegí el motivo.', { reason: 'Elegí el motivo.' })
  return attempt(id, () => cancelUnpaid(getDb(), admin, id, reason, str(form, 'note')), 'Pedido cancelado. El stock volvió y le avisamos por email.')
}

export async function trackingAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.manage')
  const url = str(form, 'trackingUrl')
  if (url && !/^https?:\/\//.test(url)) return fail('El link tiene que empezar con https://', { trackingUrl: 'Revisá el link.' })
  return attempt(id, () => saveTracking(getDb(), admin, id, { carrier: str(form, 'carrier'), trackingCode: str(form, 'trackingCode'), trackingUrl: url }), 'Seguimiento guardado.')
}

export async function noteAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.view')
  const note = str(form, 'note')
  if (!note) return fail('Escribí la nota.', { note: 'Este dato es obligatorio.' })
  return attempt(id, () => addNote(getDb(), admin, id, note), 'Nota agregada.')
}

export async function refundAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.refund')
  const lines: RefundLine[] = []
  for (const [key, value] of form.entries()) {
    const m = /^qty:(.+)$/.exec(key)
    if (!m) continue
    const quantity = Math.max(0, Math.floor(Number(value) || 0))
    if (quantity) lines.push({ orderItemId: m[1]!, quantity, restock: bool(form, `restock:${m[1]}`) })
  }
  const custom = str(form, 'amount')
  const amountCents = custom ? Math.round(Number(custom.replace(/\./g, '').replace(',', '.')) * 100) : null
  if (custom && !(amountCents! > 0)) return fail('Revisá el importe.', { amount: 'Revisá el importe.' })
  if (!lines.length && !bool(form, 'shipping') && !amountCents) return fail('Elegí qué se reembolsa.')
  return attempt(
    id,
    () => refundOrder(getDb(), id, admin, { lines, includeShipping: bool(form, 'shipping'), reason: str(form, 'reason'), amountCents }),
    'Reembolso registrado. Le avisamos por email.',
  )
}
