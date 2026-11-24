'use server'

import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import {
  ACCOUNT_ERRORS,
  authenticate,
  changePassword,
  deleteAccount,
  normalizeEmail,
  registerCustomer,
  requestPasswordReset,
  RESET_SENT,
  resetPassword,
  setNewsletter,
} from '@/server/customers/account'
import { currentCustomer, endCustomerSession } from '@/server/customers/session'
import { browserCartId, completeSignIn } from '@/server/customers/web'
import { reorder } from '@/server/customers/history'
import { ADDRESS_FIELDS, deleteAddress, saveAddress, setDefaultAddress, updateProfile, type AddressInput } from '@/server/customers/profile'
import { CHECK_FIELDS, formRaw, formText, TOO_MANY, type FormState } from '@/lib/form-state'

const MIN = 60 * 1000
const limited = async (kind: string, limit: number, windowMs: number, extra?: string) => {
  const ip = await clientIp()
  if (!rateLimit(`${kind}:ip:${ip}`, limit, windowMs).ok) return true
  return !!extra && !rateLimit(`${kind}:key:${extra}`, Math.max(3, Math.floor(limit / 2)), windowMs).ok
}

// ------------------------------------------------------------- sign in ----

/** CU-01, CU-02: the same answer for a wrong email or password, with a limit of attempts per connection and per email. */
export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(formText(form, 'email'))
  if (await limited('cuenta-login', 20, 15 * MIN, email)) return { ok: false, message: TOO_MANY }
  const customer = await authenticate(getDb(), email, formRaw(form, 'password'))
  if (!customer) return { ok: false, message: ACCOUNT_ERRORS.login }
  redirect(await completeSignIn(customer.id, { returnTo: form.get('volver'), save: form.get('guardar') }))
}

/** CU-03. */
export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  if (formText(form, 'website')) return { ok: false, message: CHECK_FIELDS } // honeypot
  if (await limited('cuenta-registro', 6, 60 * MIN)) return { ok: false, message: TOO_MANY }
  const r = await registerCustomer(getDb(), {
    name: formText(form, 'name'),
    email: formText(form, 'email'),
    password: formRaw(form, 'password'),
    acceptedTerms: form.get('terms') === 'on',
    newsletter: form.get('newsletter') === 'on',
  })
  if (!r.ok) return { ok: false, message: CHECK_FIELDS, errors: r.errors }
  redirect(await completeSignIn(r.customerId, { returnTo: form.get('volver'), save: form.get('guardar') }))
}

/** CU-04: the same confirmation whether the account exists or not. */
export async function askReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(formText(form, 'email'))
  if (!email) return { ok: false, errors: { email: ACCOUNT_ERRORS.email } }
  if (await limited('cuenta-recuperar', 6, 60 * MIN, email)) return { ok: false, message: TOO_MANY }
  await requestPasswordReset(getDb(), email)
  return { ok: true, message: RESET_SENT }
}

/** CU-05: the new password signs her in (every other session ended with the old one). */
export async function setNewPassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (await limited('cuenta-nueva', 20, 15 * MIN)) return { ok: false, message: TOO_MANY }
  const r = await resetPassword(getDb(), formText(form, 't'), formRaw(form, 'password'), formRaw(form, 'repeat'))
  if (!r.ok) return r.field ? { ok: false, errors: { [r.field]: r.error } } : { ok: false, message: r.error, code: 'expired' }
  redirect(await completeSignIn(r.customerId, { returnTo: '/cuenta', save: null }))
}

/** CU-18. */
export async function signOut() {
  await endCustomerSession()
  redirect('/')
}

// ------------------------------------------------------------ Mis datos ----

async function me() {
  const c = await currentCustomer()
  if (!c) redirect('/cuenta/ingresar?volver=/cuenta/mis-datos')
  return c
}

export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await me()
  const r = await updateProfile(getDb(), c.id, { firstName: formText(form, 'firstName'), lastName: formText(form, 'lastName'), dni: formText(form, 'dni'), phone: formText(form, 'phone') })
  if (!r.ok) return { ok: false, message: CHECK_FIELDS, errors: r.errors }
  refresh()
  return { ok: true, message: 'Guardamos tus datos.' }
}

export async function saveAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await me()
  const input = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, formText(form, k)])) as unknown as AddressInput
  input.isDefault = form.get('isDefault') === 'on'
  const r = await saveAddress(getDb(), c.id, formText(form, 'id') || null, input)
  if (!r.ok) return { ok: false, message: r.error ?? CHECK_FIELDS, errors: r.errors }
  refresh()
  return { ok: true, message: 'Guardamos la dirección.' }
}

export async function deleteAddressAction(form: FormData) {
  const c = await me()
  await deleteAddress(getDb(), c.id, formText(form, 'id'))
  refresh()
}

export async function defaultAddressAction(form: FormData) {
  const c = await me()
  await setDefaultAddress(getDb(), c.id, formText(form, 'id'))
  refresh()
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await me()
  if (await limited('cuenta-clave', 10, 15 * MIN, c.id)) return { ok: false, message: TOO_MANY }
  const r = await changePassword(getDb(), c.id, formRaw(form, 'current'), formRaw(form, 'password'), formRaw(form, 'repeat'))
  if (!r.ok) return { ok: false, errors: { [r.field]: r.error } }
  return { ok: true, message: 'Guardamos tu contraseña nueva.' }
}

export async function newsletterAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await me()
  const on = form.get('newsletter') === 'on'
  await setNewsletter(getDb(), c.id, on)
  refresh()
  return { ok: true, message: on ? 'Listo, te llega el newsletter.' : 'Listo, ya no te llega el newsletter.' }
}

/** CU-17: blocked while an order is on its way; afterwards the session ends and the confirmation shows. */
export async function deleteAccountAction(_prev: FormState): Promise<FormState> {
  const c = await me()
  const r = await deleteAccount(getDb(), c.id)
  if (!r.ok) return { ok: false, message: r.error }
  await endCustomerSession()
  redirect('/cuenta/eliminada')
}

// -------------------------------------------------------------- Pedidos ----

/** CU-12 "Volver a comprar": the order's SKUs into this browser's cart, then the cart. */
export async function reorderAction(form: FormData) {
  const c = await currentCustomer()
  if (!c) redirect('/cuenta/ingresar?volver=/cuenta/pedidos')
  const cartId = await browserCartId(c.id)
  await reorder(getDb(), c.id, formText(form, 'number'), cartId)
  redirect('/carrito')
}
