import type { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { CONTACT_REASONS, MAX_PHOTOS } from '@/server/services/content/contact'
import { whatsappLink } from '@/lib/whatsapp'
import { ContactForm } from '@/components/content/contact-form'
import { sendContactMessage } from './actions'

// CMS-03, AY-01 to AY-04, AY-15: contact form with reason and photos, the
// channels set in the panel and the support hours (D-17).

export const metadata: Metadata = { title: 'Contacto', description: '¿Dudas sobre un producto, tu pedido o tu rutina? Escribinos.', alternates: { canonical: '/contacto' } }

export default async function ContactPage() {
  const s = await getSettings()
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  const privacyPublished = !!(await getDb().legalVersion.findFirst({ where: { document: { code: 'privacidad' } }, select: { id: true } }))
  const hours = s['company.supportHours']
  const channels = [
    wa && { label: 'WhatsApp', detail: 'lo más rápido para pedidos', href: wa },
    s['company.email'] && { label: 'Email', detail: s['company.email'], href: `mailto:${s['company.email']}` },
    s['company.instagram'] && { label: 'Instagram', detail: 'mensaje directo', href: s['company.instagram'] },
  ].filter(Boolean) as { label: string; detail: string; href: string }[]

  return (
    <div className="container-page py-12 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-display-lg">Contacto</h1>
          <p className="mt-4 text-lede text-ink-soft">¿Dudas sobre un producto, tu pedido o tu rutina? Escribinos.</p>
          <div className="mt-10">
            <ContactForm
              action={sendContactMessage}
              reasons={CONTACT_REASONS}
              maxPhotos={MAX_PHOTOS}
              confirmation={
                <p>
                  Te respondemos por email en nuestro horario de atención: {hours} (hora de Argentina).
                </p>
              }
              privacy={
                <p>
                  Usamos tus datos solo para responderte
                  {privacyPublished ? (
                    <>
                      {' '}
                      (ver la{' '}
                      <Link href="/legales/privacidad" className="underline underline-offset-4">
                        política de privacidad
                      </Link>
                      ).
                    </>
                  ) : (
                    '.'
                  )}
                </p>
              }
            />
          </div>
        </div>
        <aside className="space-y-8 lg:pt-28">
          {channels.length > 0 && (
            <section aria-labelledby="canales">
              <h2 id="canales" className="text-sm font-medium uppercase tracking-[0.1em] text-ink-muted">
                Otros canales
              </h2>
              <ul className="mt-4 space-y-3">
                {channels.map((c) => (
                  <li key={c.label}>
                    <a href={c.href} className="font-medium underline-offset-4 hover:underline" {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                      {c.label}
                    </a>
                    <span className="text-ink-muted"> · {c.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="horario">
            <h2 id="horario" className="text-sm font-medium uppercase tracking-[0.1em] text-ink-muted">
              Horario de atención
            </h2>
            <p className="mt-4">{hours} (hora de Argentina)</p>
          </section>
          <section aria-labelledby="ayuda">
            <h2 id="ayuda" className="text-sm font-medium uppercase tracking-[0.1em] text-ink-muted">
              Antes de escribir
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/preguntas-frecuentes" className="underline underline-offset-4">
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <Link href="/envios-y-devoluciones" className="underline underline-offset-4">
                  Envíos y devoluciones
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
