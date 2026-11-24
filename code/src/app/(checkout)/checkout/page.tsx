import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CheckoutFlow } from '@/components/checkout/checkout-flow'
import { emptyContact } from '@/lib/commerce/checkout-form'
import { readShopCart } from '@/server/commerce/cart-cookie'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

// CK-18 (SEO): "Finalizar compra · Larutina Beauty", the brand's full name from the layout's template.
export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false, follow: false } }

// CK-01 to CK-18: guest checkout in four steps on the server cart.
export default async function CheckoutPage() {
  if (!(await canSeeCatalog())) notFound()
  const { db, s, methods, view, cart, customer } = await readShopCart()
  if (!cart.lines.length) redirect('/carrito')

  // A signed-in customer starts with her data and her default address.
  const contact = emptyContact()
  contact.email = view.email ?? ''
  if (customer) {
    const [profile, address] = await Promise.all([
      db.customer.findUnique({ where: { id: customer.id }, select: { email: true, firstName: true, lastName: true, dni: true, phone: true } }),
      db.address.findFirst({ where: { customerId: customer.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
    ])
    contact.email = profile?.email ?? customer.email
    contact.firstName = address?.firstName ?? profile?.firstName ?? ''
    contact.lastName = address?.lastName ?? profile?.lastName ?? ''
    contact.dni = address?.dni ?? profile?.dni ?? ''
    contact.phone = address?.phone ?? profile?.phone ?? ''
    if (address) {
      contact.street = address.street
      contact.unit = address.unit ?? ''
      contact.postcode = address.postcode
      contact.locality = address.locality
      contact.province = address.province
      contact.notes = address.notes ?? ''
    }
  }

  return (
    <CheckoutFlow
      initialCart={cart}
      initialContact={contact}
      signedIn={!!customer}
      methods={methods}
      transferPct={s['commerce.transferDiscountPct']}
      transferHours={s['commerce.transferReservationHours']}
      brandName={s['brand.name']}
    />
  )
}
