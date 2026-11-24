// "Mis datos" (CU-16): personal data and addresses. Addresses are checked the
// same way as at checkout (CK-04, CK-05), so a saved address always passes it.
import type { PrismaClient } from '@prisma/client'
import { normalizeDni, normalizePhone } from '@/lib/argentina'
import { CHECKOUT_ERRORS, emptyContact, validateContact, type CheckoutContact } from '@/lib/commerce/checkout-form'

export type ProfileInput = { firstName: string; lastName: string; dni: string; phone: string }
export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>

/** Only the name is required here: DNI and phone are asked at checkout, but if she writes them, they must be right. */
export async function updateProfile(db: PrismaClient, customerId: string, input: ProfileInput): Promise<{ ok: true } | { ok: false; errors: ProfileErrors }> {
  const errors: ProfileErrors = {}
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName) errors.firstName = CHECKOUT_ERRORS.required
  else if (firstName.length > 60) errors.firstName = 'Hasta 60 caracteres.'
  if (lastName.length > 60) errors.lastName = 'Hasta 60 caracteres.'
  const dni = input.dni.trim() ? normalizeDni(input.dni) : null
  if (input.dni.trim() && !dni) errors.dni = CHECKOUT_ERRORS.dni
  const phone = input.phone.trim() ? normalizePhone(input.phone) : null
  if (input.phone.trim() && !phone) errors.phone = CHECKOUT_ERRORS.phone
  if (Object.keys(errors).length) return { ok: false, errors }
  await db.customer.update({ where: { id: customerId }, data: { firstName, lastName: lastName || null, dni, phone } })
  return { ok: true }
}

export const ADDRESS_FIELDS = ['firstName', 'lastName', 'dni', 'phone', 'street', 'unit', 'postcode', 'locality', 'province', 'notes'] as const
export type AddressField = (typeof ADDRESS_FIELDS)[number]
export type AddressInput = Record<AddressField, string> & { isDefault?: boolean }
export type AddressErrors = Partial<Record<AddressField, string>>

/** The checkout's own check (CK-05) over the address fields. */
export function checkAddress(input: AddressInput) {
  const contact: CheckoutContact = { ...emptyContact(), email: 'cuenta@larutina.invalid' }
  for (const k of ADDRESS_FIELDS) contact[k] = input[k] ?? ''
  const r = validateContact(contact)
  if (!r.ok) {
    const errors: AddressErrors = {}
    for (const k of ADDRESS_FIELDS) if (r.errors[k]) errors[k] = r.errors[k]
    return { ok: false as const, errors }
  }
  const v = r.value
  return {
    ok: true as const,
    value: { firstName: v.firstName, lastName: v.lastName, dni: v.dni, phone: v.phone, street: v.street, unit: v.unit || null, postcode: v.postcode, locality: v.locality, province: v.province, notes: v.notes || null },
  }
}

export const MAX_ADDRESSES = 10

export async function saveAddress(db: PrismaClient, customerId: string, addressId: string | null, input: AddressInput): Promise<{ ok: true; id: string } | { ok: false; errors: AddressErrors; error?: string }> {
  const checked = checkAddress(input)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  if (addressId) {
    const own = await db.address.findFirst({ where: { id: addressId, customerId }, select: { id: true } })
    if (!own) return { ok: false, errors: {}, error: 'Esa dirección ya no está en tu cuenta.' }
  } else if ((await db.address.count({ where: { customerId } })) >= MAX_ADDRESSES) {
    return { ok: false, errors: {}, error: `Podés guardar hasta ${MAX_ADDRESSES} direcciones.` }
  }
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { customerId } })
    const makeDefault = !!input.isDefault || count === 0 || (!addressId ? false : (await tx.address.findUniqueOrThrow({ where: { id: addressId } })).isDefault)
    if (makeDefault) await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } })
    const row = addressId
      ? await tx.address.update({ where: { id: addressId }, data: { ...checked.value, isDefault: makeDefault } })
      : await tx.address.create({ data: { customerId, ...checked.value, isDefault: makeDefault } })
    return { ok: true as const, id: row.id }
  })
}

export async function deleteAddress(db: PrismaClient, customerId: string, addressId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.address.findFirst({ where: { id: addressId, customerId } })
    if (!row) return
    await tx.address.delete({ where: { id: row.id } })
    if (row.isDefault) {
      const next = await tx.address.findFirst({ where: { customerId }, orderBy: { updatedAt: 'desc' } })
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
}

export async function setDefaultAddress(db: PrismaClient, customerId: string, addressId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.address.findFirst({ where: { id: addressId, customerId }, select: { id: true } })
    if (!row) return
    await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } })
    await tx.address.update({ where: { id: row.id }, data: { isDefault: true } })
  })
}
