// Who may open an order page: the signed link from the confirmation and the
// emails (PED-05), the number with the purchase's email (CU-20, through
// findOrderForCustomer), or the account the order belongs to.
import { getDb } from '@/server/db'
import { currentCustomer } from '@/server/customers/session'
import { CART_COOKIE, hashCartToken } from './cart'
import { findOrderForCustomer, normalizeOrderNumber } from './aftersale'
import { cookies } from 'next/headers'

const include = { items: true, shipment: true, payments: { orderBy: { createdAt: 'desc' } }, refunds: true } as const

export async function orderForRequest(number: string, token: string | null | undefined) {
  const db = getDb()
  const byLink = await findOrderForCustomer(db, { number, token })
  if (byLink) return byLink
  const n = normalizeOrderNumber(number)
  const customer = await currentCustomer()
  if (!n || !customer) return null
  return db.order.findFirst({ where: { number: n, customerId: customer.id, anonymizedAt: null }, include })
}

/**
 * Back from Mercado Pago (back_urls carry only the number): the order is
 * this browser's when it was placed from the cart its cookie names, or by
 * the signed-in customer.
 */
export async function orderOfThisBrowser(number: string) {
  const db = getDb()
  const n = normalizeOrderNumber(number)
  if (!n) return null
  const order = await db.order.findUnique({ where: { number: n }, include })
  if (!order || order.anonymizedAt) return null
  const token = (await cookies()).get(CART_COOKIE)?.value
  const cart = token ? await db.cart.findUnique({ where: { token: hashCartToken(token) }, select: { id: true } }) : null
  if (cart && order.cartId === cart.id) return order
  const customer = await currentCustomer()
  if (customer && order.customerId === customer.id) return order
  return null
}
