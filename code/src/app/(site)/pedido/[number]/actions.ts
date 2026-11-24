'use server'

import { refresh } from 'next/cache'
import { getDb } from '@/server/db'
import { files } from '@/server/admin/forms'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { orderForRequest } from '@/server/commerce/order-access'
import { attachTransferReceipt } from '@/server/commerce/payments'
import { saveReceipt } from '@/server/commerce/receipts'
import { accountFromOrder } from '@/server/customers/account'
import { currentCustomer, startCustomerSession } from '@/server/customers/session'

export type OrderFormState = { ok: boolean; message: string } | null

const text = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

const NOT_ALLOWED = 'Este link ya venció. Pedí uno nuevo.'

/** CMP-05, CK-08: the transfer receipt, from the order page. From then on the order waits for review instead of expiring. */
export async function uploadReceipt(_prev: OrderFormState, form: FormData): Promise<OrderFormState> {
  if (!rateLimit(`receipt:${await clientIp()}`, 10, 60 * 60_000).ok) return { ok: false, message: 'Recibimos muchos archivos desde tu conexión. Probá de nuevo en un rato o escribinos por WhatsApp.' }
  const order = await orderForRequest(text(form, 'number'), text(form, 't'))
  if (!order) return { ok: false, message: NOT_ALLOWED }
  const [file] = await files(form, 'receipt')
  if (!file) return { ok: false, message: 'Elegí la imagen o el PDF del comprobante.' }
  const saved = await saveReceipt(getDb(), file, order.email)
  if (!saved.ok) return { ok: false, message: saved.error }
  const attached = await attachTransferReceipt(getDb(), order.id, saved.key, { type: 'CUSTOMER', label: order.email })
  if (!attached) return { ok: false, message: 'Este pedido ya no espera una transferencia.' }
  refresh()
  return { ok: true, message: 'Recibimos tu comprobante. Lo revisamos y te avisamos por email.' }
}

/** CF-04, IR-12: a guest creates her account from the confirmation with only a password. */
export async function createAccountFromOrder(_prev: OrderFormState, form: FormData): Promise<OrderFormState> {
  if (!rateLimit(`account-from-order:${await clientIp()}`, 10, 60 * 60_000).ok) return { ok: false, message: 'Recibimos muchos intentos seguidos. Probá de nuevo en un rato.' }
  if (await currentCustomer()) return { ok: true, message: '' }
  const order = await orderForRequest(text(form, 'number'), text(form, 't'))
  if (!order || order.customerId) return { ok: false, message: NOT_ALLOWED }
  const password = form.get('password')
  const result = await accountFromOrder(getDb(), order.id, typeof password === 'string' ? password : '')
  if (!result.ok) return { ok: false, message: result.error }
  await startCustomerSession(result.customerId)
  refresh()
  return { ok: true, message: '' }
}
