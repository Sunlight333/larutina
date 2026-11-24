import { describe, expect, it } from 'vitest'
import { normalizeCuit, normalizeDni, normalizePhone, parsePostcode, postcodeMatchesProvince } from '@/lib/argentina'
import { CHECKOUT_ERRORS, emptyContact, validateContact } from '@/lib/commerce/checkout-form'
import { canMove, nextStatuses, STATUS_LABELS } from '@/lib/commerce/order-status'

describe('Argentine checks (CK-04, CK-05)', () => {
  it('reads both postcode forms and ties a CPA to its province', () => {
    expect(parsePostcode('1425')).toEqual({ digits: '1425', cpa: null, province: null })
    expect(parsePostcode('c1425abc')).toEqual({ digits: '1425', cpa: 'C1425ABC', province: 'C' })
    expect(parsePostcode('14250')).toBeNull()
    expect(parsePostcode('0123')).toBeNull()
    expect(postcodeMatchesProvince('C1425ABC', 'C')).toBe(true)
    expect(postcodeMatchesProvince('C1425ABC', 'B')).toBe(false)
  })

  it('rules out a four-digit postcode that cannot be in the province, and nothing more', () => {
    expect(postcodeMatchesProvince('1425', 'C')).toBe(true)
    expect(postcodeMatchesProvince('1425', 'M')).toBe(false)
    expect(postcodeMatchesProvince('5500', 'M')).toBe(true)
    expect(postcodeMatchesProvince('8400', 'R')).toBe(true)
    expect(postcodeMatchesProvince('9410', 'V')).toBe(true)
    expect(postcodeMatchesProvince('2820', 'E')).toBe(true) // Gualeguaychú, in the 2000s
  })

  it('accepts a phone with its area code however it is written', () => {
    expect(normalizePhone('+54 9 11 5039-0302')).toBe('1150390302')
    expect(normalizePhone('011 15 5039-0302')).toBe('1150390302')
    expect(normalizePhone('(351) 456-7890')).toBe('3514567890')
    expect(normalizePhone('0351 15 456-7890')).toBe('3514567890')
    expect(normalizePhone('4567-8901')).toBeNull()
  })

  it('checks DNI and the CUIT check digit', () => {
    expect(normalizeDni('30.123.456')).toBe('30123456')
    expect(normalizeDni('123')).toBeNull()
    expect(normalizeCuit('20-12345678-6')).toBe('20123456786')
    expect(normalizeCuit('20-12345678-5')).toBeNull()
  })
})

describe('checkout step 1', () => {
  const valid = { ...emptyContact(), email: 'Ana@Mail.com', firstName: 'Ana', lastName: 'Pérez', dni: '30.123.456', phone: '11 5039-0302', street: 'Av. Corrientes 1234', postcode: '1414', locality: 'CABA', province: 'C' }

  it('cleans a valid form', () => {
    const r = validateContact(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ email: 'ana@mail.com', dni: '30123456', phone: '1150390302', invoice: null })
  })

  it('puts the content file message on the field that is wrong', () => {
    const r = validateContact({ ...valid, email: 'ana@', phone: '5039-0302', postcode: '1414', province: 'M', firstName: ' ' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.email).toBe(CHECKOUT_ERRORS.email)
      expect(r.errors.phone).toBe(CHECKOUT_ERRORS.phone)
      expect(r.errors.postcode).toBe(CHECKOUT_ERRORS.postcode)
      expect(r.errors.firstName).toBe(CHECKOUT_ERRORS.required)
    }
  })

  it('asks for CUIT and business name only for Factura A', () => {
    const r = validateContact({ ...valid, wantsInvoiceA: true, cuit: '20-12345678-6', businessName: 'Ana SRL' })
    expect(r.ok && r.value.invoice).toEqual({ cuit: '20123456786', businessName: 'Ana SRL' })
    const missing = validateContact({ ...valid, wantsInvoiceA: true })
    expect(!missing.ok && missing.errors.cuit).toBe(CHECKOUT_ERRORS.required)
  })
})

describe('order states (PED-01)', () => {
  it('a paid order never goes back to cancelled: it leaves through a refund', () => {
    expect(canMove('PENDING_PAYMENT', 'CANCELLED')).toBe(true)
    expect(canMove('PAID', 'CANCELLED')).toBe(false)
    expect(canMove('PAID', 'REFUNDED')).toBe(true)
    expect(nextStatuses('REFUNDED')).toEqual([])
    expect(nextStatuses('CANCELLED')).toEqual([])
  })

  it('a partial refund does not stop the shipment', () => {
    expect(canMove('PARTIALLY_REFUNDED', 'SHIPPED')).toBe(true)
    expect(canMove('PARTIALLY_REFUNDED', 'PENDING_PAYMENT')).toBe(false)
  })

  it('uses the account page wording', () => {
    expect(STATUS_LABELS.PENDING_PAYMENT).toBe('Esperando pago')
    expect(STATUS_LABELS.SHIPPED).toBe('Enviado')
  })
})
