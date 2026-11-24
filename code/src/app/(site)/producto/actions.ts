'use server'

import { refresh } from 'next/cache'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { toggleFavorite } from '@/server/customers/account'
import { currentCustomer } from '@/server/customers/session'
import { requestBackInStock } from '@/server/commerce/aftersale'
import { formText, TOO_MANY, type FormState } from '@/lib/form-state'

/** F-08 "Guardar": without a session the button sends her to sign in instead (PDP-09). */
export async function toggleFavoriteAction(productId: string, refreshPage = false): Promise<{ signedIn: false } | { signedIn: true; saved: boolean }> {
  const customer = await currentCustomer()
  if (!customer) return { signedIn: false }
  if (!rateLimit(`favorito:${customer.id}`, 120, 60 * 60 * 1000).ok) return { signedIn: true, saved: false }
  const saved = await toggleFavorite(getDb(), customer.id, String(productId).slice(0, 40))
  if (refreshPage) refresh()
  return { signedIn: true, saved }
}

/** G-13 "Avisame cuando vuelva": one notice by email when stock comes back (NAV-07). */
export async function backInStockAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (formText(form, 'website')) return { ok: true, message: 'Te avisamos apenas vuelva.' } // honeypot
  if (!rateLimit(`aviso-stock:${await clientIp()}`, 10, 60 * 60 * 1000).ok) return { ok: false, message: TOO_MANY }
  const r = await requestBackInStock(getDb(), formText(form, 'sku'), formText(form, 'email'))
  if (!r.ok) return { ok: false, errors: { email: r.error } }
  return { ok: true, message: 'Te avisamos apenas vuelva.' }
}
