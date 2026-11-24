'use server'

import { cookies } from 'next/headers'
import { getDb } from '@/server/db'
import { isEmail } from '@/lib/argentina'
import { emptyContact, type CheckoutContact, type FieldErrors } from '@/lib/commerce/checkout-form'
import { findCartById } from '@/server/commerce/cart'
import { shopCart, type ShopCart } from '@/server/commerce/cart-access'
import { browserCart, shopContext, TOO_MANY } from '@/server/commerce/cart-cookie'
import { placeOrder, type PaymentChoice } from '@/server/commerce/checkout'
import { orderPath } from '@/server/commerce/orders'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { canSeeCatalog } from '@/server/services/catalog/viewer'
import { REF_COOKIE } from '@/lib/commerce/attribution'

/**
 * Step 1 complete: the email goes on the cart, so the abandoned-cart email
 * (EML-04) can reach her if she leaves before paying.
 */
export async function saveCheckoutEmail(email: string): Promise<void> {
  const e = String(email ?? '').trim().toLowerCase()
  if (!isEmail(e) || e.length > 120) return
  if (!(await canSeeCatalog())) return
  if (!rateLimit(`checkout-email:${await clientIp()}`, 30, 10 * 60_000).ok) return
  const { cartId } = await browserCart({ create: false, write: true })
  if (cartId) await getDb().cart.update({ where: { id: cartId }, data: { email: e } })
}

export type PlaceOrderState =
  | { ok: true; redirect: string }
  | { ok: false; reason: 'fields'; errors: FieldErrors }
  | { ok: false; reason: string; message: string; cart?: ShopCart; notices?: string[] }

const STRING_FIELDS = ['email', 'firstName', 'lastName', 'dni', 'phone', 'street', 'unit', 'postcode', 'locality', 'province', 'notes', 'cuit', 'businessName'] as const

function cleanContact(raw: unknown): CheckoutContact {
  const r = (raw ?? {}) as Record<string, unknown>
  const c = emptyContact()
  for (const k of STRING_FIELDS) c[k] = typeof r[k] === 'string' ? (r[k] as string).slice(0, 400) : ''
  c.newsletter = r.newsletter === true
  c.wantsInvoiceA = r.wantsInvoiceA === true
  return c
}

/** CK-13 "Confirmar compra": everything is checked again on the server (placeOrder). */
export async function placeOrderAction(input: { contact: unknown; shippingKey: unknown; method: unknown; acceptedTerms: unknown }): Promise<PlaceOrderState> {
  if (!(await canSeeCatalog())) return { ok: false, reason: 'closed', message: 'La tienda no está disponible en este momento.' }
  if (!rateLimit(`checkout:${await clientIp()}`, 20, 10 * 60_000).ok) return { ok: false, reason: 'rate', message: TOO_MANY }
  const method = input.method === 'transfer' || input.method === 'mercadopago' ? (input.method as PaymentChoice) : null
  if (!method) return { ok: false, reason: 'method', message: 'Elegí un medio de pago.' }
  const { token, customer } = await browserCart({ create: false, write: true })
  const result = await placeOrder(getDb(), {
    cartToken: token,
    customerId: customer?.id ?? null,
    contact: cleanContact(input.contact),
    shippingKey: typeof input.shippingKey === 'string' ? input.shippingKey : '',
    method,
    acceptedTerms: input.acceptedTerms === true,
    // IR-17: her ambassador's link on this device.
    refCookie: (await cookies()).get(REF_COOKIE)?.value ?? null,
  })
  if (result.ok) return { ok: true, redirect: result.redirectUrl ?? orderPath({ id: result.orderId, number: result.number }) }
  if (result.reason === 'fields') return { ok: false, reason: 'fields', errors: result.errors }
  if (result.reason === 'stock' || result.reason === 'cart-changed' || result.reason === 'coupon') {
    // The summary shows the cart as it is now.
    const ctx = await shopContext()
    const { cartId } = await browserCart({ create: false, write: false })
    const { cart } = await shopCart(ctx.db, await findCartById(ctx.db, cartId), ctx.s, { transferAvailable: ctx.transferAvailable, fix: true })
    return { ok: false, reason: result.reason, message: result.message, cart, notices: result.reason === 'cart-changed' ? result.notices : [result.message] }
  }
  return { ok: false, reason: result.reason, message: result.message }
}
