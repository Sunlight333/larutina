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

describe('ambassador attribution (IR-17, EB-C03)', async () => {
  const { resolveAttribution, isSelfPurchase, commissionFor, decodeRef, encodeRef } = await import('@/lib/commerce/attribution')
  const now = new Date('2026-12-20T12:00:00Z')
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000)
  const a = (id: string, at?: Date) => ({ ambassadorId: id, code: id.toUpperCase(), at })

  it('code > cart > cookie > account, and links only within the window', () => {
    expect(resolveAttribution({ code: a('uno'), cart: a('dos'), cookie: a('tres', days(1)), account: a('cuatro', days(1)), windowDays: 30, now })?.source).toBe('CODE')
    expect(resolveAttribution({ cart: a('dos'), cookie: a('tres', days(1)), windowDays: 30, now })?.ambassadorId).toBe('dos')
    expect(resolveAttribution({ cookie: a('tres', days(31)), account: a('cuatro', days(2)), windowDays: 30, now })?.source).toBe('ACCOUNT')
    expect(resolveAttribution({ cookie: a('tres', days(31)), account: a('cuatro', days(40)), windowDays: 30, now })).toBeNull()
  })

  it('blocks her own purchases by email, account or the DNI inside her CUIT', () => {
    const amb = { email: 'Prof@Mail.com', customerId: 'c1', cuit: '27-30123456-4' }
    expect(isSelfPurchase({ ambassador: amb, order: { email: 'prof@mail.com', customerId: null, dni: '1' } })).toBe(true)
    expect(isSelfPurchase({ ambassador: amb, order: { email: 'x@mail.com', customerId: 'c1', dni: '1' } })).toBe(true)
    expect(isSelfPurchase({ ambassador: amb, order: { email: 'x@mail.com', customerId: null, dni: '30123456' } })).toBe(true)
    expect(isSelfPurchase({ ambassador: amb, order: { email: 'x@mail.com', customerId: 'c2', dni: '30123457' } })).toBe(false)
  })

  it('computes per line on the price without VAT, with each line’s rate', () => {
    const c = commissionFor([{ orderItemId: 'i1', totalCents: 1_210_000, vatPct: 21, ratePct: 15 }, { orderItemId: 'i2', totalCents: 1_105_000, vatPct: 10.5, ratePct: 10 }], true)
    expect(c.lines.map((l) => l.baseCents)).toEqual([1_000_000, 1_000_000])
    expect(c.amountCents).toBe(150_000 + 100_000)
    expect(commissionFor([{ orderItemId: 'i1', totalCents: 1_210_000, vatPct: 21, ratePct: 15 }], false).amountCents).toBe(181_500)
  })

  it('reads back the link cookie it wrote, and nothing else', () => {
    const at = new Date('2026-12-01T10:00:00Z')
    expect(decodeRef(encodeRef('ANAPEREZ', at))).toEqual({ code: 'ANAPEREZ', at })
    expect(decodeRef('anaperez.123')).toBeNull()
  })
})
