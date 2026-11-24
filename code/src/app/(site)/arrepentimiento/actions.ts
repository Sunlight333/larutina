'use server'

import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { requestWithdrawal } from '@/server/commerce/aftersale'
import { CHECK_FIELDS, formText, TOO_MANY, type FormState } from '@/lib/form-state'

/** LE-04, PED-04: no account needed; the code is generated on sending and shown at once. */
export async function sendWithdrawal(_prev: FormState, form: FormData): Promise<FormState> {
  if (formText(form, 'website')) return { ok: false, message: CHECK_FIELDS } // honeypot
  if (!rateLimit(`arrepentimiento:${await clientIp()}`, 10, 60 * 60 * 1000).ok) return { ok: false, message: TOO_MANY }
  const r = await requestWithdrawal(getDb(), { orderNumber: formText(form, 'orderNumber'), contact: formText(form, 'contact'), reason: formText(form, 'reason') })
  if (!r.ok) return { ok: false, message: CHECK_FIELDS, errors: r.errors }
  return { ok: true, code: r.code }
}
