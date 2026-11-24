import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CartView } from '@/components/cart/cart-view'
import { quoteCart, type PublicQuote } from '@/server/commerce/cart-access'
import { readShopCart } from '@/server/commerce/cart-cookie'
import { canSeeCatalog } from '@/server/services/catalog/viewer'
import { whatsappLink } from '@/lib/whatsapp'

// CK-18 (SEO): "Tu bolsa · Larutina Beauty", with "carrito" (D-05). The
// layout's template adds the brand's full name from the settings.
export const metadata: Metadata = { title: 'Tu carrito', robots: { index: false, follow: true } }

const METHOD_NAMES = { mercadopago: 'Mercado Pago', transfer: 'transferencia' } as const

// /carrito (BO-01 to BO-13) on the server cart. Routine grouping (BO-03,
// BO-04) arrives with routines in Phase 3.
export default async function CartPage() {
  if (!(await canSeeCatalog())) notFound()
  const { db, s, methods, view, cart } = await readShopCart()
  const whatsapp = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], 'Hola, tengo una duda sobre mi compra') : null
  // BO-10: "Pagás con Mercado Pago o transferencia", from the ways to pay offered right now.
  const names = methods.map((m) => METHOD_NAMES[m])
  const paymentLine = names.length ? `Pagás con ${names.join(' o ')}` : null
  // The last postcode she quoted, quoted again with the cart as it is now (BO-08).
  const quote: PublicQuote | null = view.postcode && view.lines.length ? await quoteCart(db, view, s, { postcode: view.postcode }) : null
  return (
    <CartView
      initial={cart}
      initialPostcode={view.postcode ?? ''}
      initialQuote={quote?.ok ? quote : null}
      freeFromCents={s['commerce.freeShippingFromCents']}
      whatsapp={whatsapp}
      paymentLine={paymentLine}
    />
  )
}
