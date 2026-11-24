import type { Metadata } from 'next'
import Link from 'next/link'
import { PageIntro } from '@/components/catalog/page-intro'
import { getSettings } from '@/server/settings'
import { getLegalLinks } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'
import { WithdrawalForm } from '@/components/content/withdrawal-form'

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento',
  description: 'Tenés 10 días corridos desde que recibiste tu compra para arrepentirte, sin dar motivo y sin costo.',
  alternates: { canonical: '/arrepentimiento' },
}

// LE-04 (Res. SCI 424/2020): the exact name, reachable from every page's
// footer, no account needed. The form generates the procedure code on sending
// (PED-04); an order in "Mis pedidos" opens it with its number filled in
// (CU-14). The contact channels from the panel stay as another way to ask.
export default async function WithdrawalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const pedido = (await searchParams).pedido
  const orderNumber = (Array.isArray(pedido) ? pedido[0] : pedido)?.trim().slice(0, 30) ?? ''
  const [s, legal] = await Promise.all([getSettings(), getLegalLinks()])
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], 'Hola, quiero arrepentirme de una compra') : null
  const returns = legal.find((d) => d.code === 'cambios-y-devoluciones')
  const channels = [
    s['company.email'] && { label: 'Email', value: s['company.email'], href: `mailto:${s['company.email']}` },
    wa && { label: 'WhatsApp', value: s['company.whatsapp'], href: wa },
    { label: 'Formulario de contacto', value: 'Elegí el motivo "Mi pedido"', href: '/contacto' },
  ].filter((c): c is { label: string; value: string; href: string } => !!c)

  return (
    <>
      <PageIntro
        eyebrow="Arrepentimiento"
        title="Botón de arrepentimiento"
        intro={['Tenés 10 días corridos desde que recibiste tu compra para arrepentirte, sin dar motivo y sin costo.']}
      />
      <div className="container-page grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <section aria-label="Botón de arrepentimiento" className="self-start rounded-[1.5rem_3rem_1.5rem_3rem] bg-paper p-5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-8">
          <WithdrawalForm orderNumber={orderNumber} />
        </section>
        <section aria-labelledby="como-pedirlo">
          <h2 id="como-pedirlo" className="font-display text-display-sm">
            Cómo pedirlo
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Escribinos con tu número de pedido y el email o teléfono que usaste en la compra. Te respondemos dentro de las 24 horas con tu código de trámite y coordinamos el retiro.
          </p>
          <ul className="mt-5 grid gap-3">
            {channels.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}
                  className="block h-full rounded-[1.75rem] bg-shell p-5 transition-colors hover:bg-sand"
                >
                  <span className="block text-sm text-ink-muted">{c.label}</span>
                  <span className="mt-1 block font-medium">{c.value}</span>
                </a>
              </li>
            ))}
          </ul>
          {s['company.supportHours'] && <p className="mt-4 text-sm text-ink-muted">Atención: {s['company.supportHours']}.</p>}
          {returns && (
            <p className="mt-8 text-sm text-ink-soft">
              Las condiciones completas están en{' '}
              <Link href={`/legales/${returns.code}`} className="underline underline-offset-2">
                {returns.title}
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </>
  )
}
