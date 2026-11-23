import type { Metadata } from 'next'
import Link from 'next/link'
import { getSettings } from '@/server/settings'
import { getLegalLinks } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento',
  description: 'Tenés 10 días corridos desde que recibiste tu compra para arrepentirte, sin dar motivo y sin costo.',
  alternates: { canonical: '/arrepentimiento' },
}

// LE-04 (Res. SCI 424/2020): the exact name, reachable from every page's
// footer, no account needed. The online form with its automatic code comes
// with orders in Phase 2 (PED-04); until then the page explains the right
// and lists the contact channels from the panel.
export default async function WithdrawalPage() {
  const [s, legal] = await Promise.all([getSettings(), getLegalLinks()])
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], 'Hola, quiero arrepentirme de una compra') : null
  const returns = legal.find((d) => d.code === 'cambios-y-devoluciones')
  const channels = [
    s['company.email'] && { label: 'Email', value: s['company.email'], href: `mailto:${s['company.email']}` },
    wa && { label: 'WhatsApp', value: s['company.whatsapp'], href: wa },
    { label: 'Formulario de contacto', value: 'Elegí el motivo "Mi pedido"', href: '/contacto' },
  ].filter((c): c is { label: string; value: string; href: string } => !!c)

  return (
    <section className="container-page py-14 sm:py-20">
      <h1 className="max-w-3xl font-display text-display-lg text-balance">Botón de arrepentimiento</h1>
      <div className="mt-6 max-w-2xl space-y-4 text-lede text-ink-soft">
        <p>Tenés 10 días corridos desde que recibiste tu compra para arrepentirte, sin dar motivo y sin costo.</p>
        <p>
          Escribinos con tu número de pedido y el email o teléfono que usaste en la compra. Te respondemos dentro de las 24 horas con tu código de trámite y coordinamos el
          retiro.
        </p>
      </div>

      <h2 className="mt-12 font-display text-display-sm">Cómo pedirlo</h2>
      <ul className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
        {channels.map((c) => (
          <li key={c.label}>
            <a
              href={c.href}
              {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}
              className="block h-full rounded-[var(--radius-card)] border border-line p-5 transition-colors hover:border-ink"
            >
              <span className="block text-sm text-ink-muted">{c.label}</span>
              <span className="mt-1 block font-medium">{c.value}</span>
            </a>
          </li>
        ))}
      </ul>
      {s['company.supportHours'] && <p className="mt-4 text-sm text-ink-muted">Atención: {s['company.supportHours']}.</p>}

      <p className="mt-10 max-w-2xl text-sm text-ink-soft">
        El formulario para hacerlo en línea, con el código de trámite automático, se habilita cuando abra la tienda, junto con los pedidos.
        {returns && (
          <>
            {' '}
            Las condiciones completas están en{' '}
            <Link href={`/legales/${returns.code}`} className="underline underline-offset-2">
              {returns.title}
            </Link>
            .
          </>
        )}
      </p>
    </section>
  )
}
