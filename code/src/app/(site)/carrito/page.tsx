import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'
import { PageIntro } from '@/components/catalog/page-intro'
import { getSettings } from '@/server/settings'
import { whatsappLink } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Tu carrito', robots: { index: false, follow: true } }

const PAYMENT_NAMES: Record<string, string> = { mercadopago: 'Mercado Pago', tarjetas: 'tarjeta', transferencia: 'transferencia' }

// The minimal cart of Phase 1: checkout and payment arrive in Phase 2.
export default async function CartPage() {
  const s = await getSettings()
  const whatsapp = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], 'Hola, tengo una duda sobre mi compra') : null
  const methods = s['commerce.paymentMethods'].map((m) => PAYMENT_NAMES[m]).filter((m): m is string => !!m)
  // BO-10: "Pagás con Mercado Pago o transferencia", from the active methods.
  const paymentLine = methods.length ? `Pagás con ${methods.length > 1 ? `${methods.slice(0, -1).join(', ')} o ${methods.at(-1)}` : methods[0]}.` : null
  return (
    <>
      <PageIntro title="Tu carrito" />
      <section className="container-page" aria-label="Productos en tu carrito">
        <CartView whatsapp={whatsapp} paymentLine={paymentLine} />
      </section>
    </>
  )
}
