'use server'

import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { submitReview } from '@/server/commerce/aftersale'
import { currentCustomer } from '@/server/customers/session'
import { CHECK_FIELDS, formText, TOO_MANY, type FormState } from '@/lib/form-state'

/** PDP-07, F-22: a verified buyer's review, published once the team checks it. */
export async function submitReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`resena:${await clientIp()}`, 30, 60 * 60 * 1000).ok) return { ok: false, message: TOO_MANY }
  const customer = await currentCustomer()
  const r = await submitReview(
    getDb(),
    formText(form, 'number'),
    { token: formText(form, 't') || null, customerId: customer?.id ?? null },
    { orderItemId: formText(form, 'line'), rating: Number(formText(form, 'rating')), title: formText(form, 'title'), body: formText(form, 'body'), usageTime: formText(form, 'usageTime') },
  )
  if (!r.ok) return r.errors.form ? { ok: false, message: r.errors.form } : { ok: false, message: CHECK_FIELDS, errors: r.errors }
  return { ok: true, message: 'Gracias por tu reseña. La publicamos cuando la revisemos.' }
}
