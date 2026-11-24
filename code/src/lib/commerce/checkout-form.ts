// Step 1 of the checkout (CK-03, CK-04, CK-10) and its errors (CK-05), field
// by field, with the content file's messages. Pure: the form checks as the
// customer types and the server checks again before placing the order.
import { isEmail, isProvince, normalizeCuit, normalizeDni, normalizePhone, parsePostcode, postcodeMatchesProvince } from '@/lib/argentina'

export const CHECKOUT_ERRORS = {
  email: 'Ingresá un email válido.',
  required: 'Este dato es obligatorio.',
  postcode: 'Revisá el código postal.',
  phone: 'Ingresá un teléfono con código de área.',
  dni: 'Revisá el DNI: son 7 u 8 números.',
  cuit: 'Revisá el CUIT.',
} as const

export type CheckoutContact = {
  email: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  street: string
  unit: string
  postcode: string
  locality: string
  province: string
  notes: string
  newsletter: boolean
  wantsInvoiceA: boolean
  cuit: string
  businessName: string
}

export type CleanContact = Omit<CheckoutContact, 'dni' | 'phone' | 'postcode' | 'cuit' | 'wantsInvoiceA' | 'businessName'> & {
  dni: string
  phone: string
  postcode: string
  invoice: { cuit: string; businessName: string } | null
}

export type FieldErrors = Partial<Record<keyof CheckoutContact, string>>

const LIMITS: Partial<Record<keyof CheckoutContact, number>> = {
  email: 120,
  firstName: 60,
  lastName: 60,
  street: 120,
  unit: 40,
  locality: 80,
  notes: 300,
  businessName: 120,
}

export function emptyContact(): CheckoutContact {
  return { email: '', firstName: '', lastName: '', dni: '', phone: '', street: '', unit: '', postcode: '', locality: '', province: '', notes: '', newsletter: false, wantsInvoiceA: false, cuit: '', businessName: '' }
}

export function validateContact(input: CheckoutContact): { ok: true; value: CleanContact } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const t = (k: keyof CheckoutContact) => String(input[k] ?? '').trim()
  const required = (k: keyof CheckoutContact) => {
    if (!t(k)) errors[k] = CHECKOUT_ERRORS.required
  }

  if (!isEmail(t('email'))) errors.email = CHECKOUT_ERRORS.email
  for (const k of ['firstName', 'lastName', 'street', 'locality'] as const) required(k)

  const dni = normalizeDni(t('dni'))
  if (!t('dni')) errors.dni = CHECKOUT_ERRORS.required
  else if (!dni) errors.dni = CHECKOUT_ERRORS.dni

  const phone = normalizePhone(t('phone'))
  if (!t('phone')) errors.phone = CHECKOUT_ERRORS.required
  else if (!phone) errors.phone = CHECKOUT_ERRORS.phone

  if (!t('province') || !isProvince(t('province'))) errors.province = CHECKOUT_ERRORS.required
  const postcode = parsePostcode(t('postcode'))
  if (!t('postcode')) errors.postcode = CHECKOUT_ERRORS.required
  else if (!postcode) errors.postcode = CHECKOUT_ERRORS.postcode
  else if (isProvince(t('province')) && !postcodeMatchesProvince(t('postcode'), t('province'))) errors.postcode = CHECKOUT_ERRORS.postcode

  let invoice: CleanContact['invoice'] = null
  if (input.wantsInvoiceA) {
    const cuit = normalizeCuit(t('cuit'))
    if (!t('cuit')) errors.cuit = CHECKOUT_ERRORS.required
    else if (!cuit) errors.cuit = CHECKOUT_ERRORS.cuit
    if (!t('businessName')) errors.businessName = CHECKOUT_ERRORS.required
    if (cuit && t('businessName')) invoice = { cuit, businessName: t('businessName') }
  }

  for (const [k, max] of Object.entries(LIMITS) as [keyof CheckoutContact, number][]) {
    if (!errors[k] && t(k).length > max) errors[k] = `Hasta ${max} caracteres.`
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      email: t('email').toLowerCase(),
      firstName: t('firstName'),
      lastName: t('lastName'),
      dni: dni!,
      phone: phone!,
      street: t('street'),
      unit: t('unit'),
      postcode: postcode!.cpa ?? postcode!.digits,
      locality: t('locality'),
      province: t('province'),
      notes: t('notes'),
      newsletter: !!input.newsletter,
      invoice,
    },
  }
}
