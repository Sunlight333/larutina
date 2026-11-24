'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { findOrderForCustomer } from '@/server/commerce/aftersale'
import { orderPath } from '@/server/commerce/orders'

export type LookupState = { error: string; number: string; email: string } | null

/** CU-20: number and the purchase's email open the order page (by its signed link). */
export async function lookupOrder(_prev: LookupState, form: FormData): Promise<LookupState> {
  const number = String(form.get('number') ?? '').trim().slice(0, 30)
  const email = String(form.get('email') ?? '').trim().slice(0, 120)
  if (!number || !email) return { error: 'Este dato es obligatorio.', number, email }
  if (!rateLimit(`order-lookup:${await clientIp()}`, 10, 10 * 60_000).ok) return { error: 'Recibimos muchas búsquedas seguidas. Probá de nuevo en un rato.', number, email }
  const order = await findOrderForCustomer(getDb(), { number, email })
  if (!order) return { error: 'No encontramos un pedido con ese número y ese email.', number, email }
  redirect(orderPath(order))
}
