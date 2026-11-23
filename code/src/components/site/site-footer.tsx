import Image from 'next/image'
import Link from 'next/link'
import { getSettings, type LinkItem } from '@/server/settings'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { getLegalLinks } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'
import { Wordmark } from '@/components/site/wordmark'
import { SignupForm } from '@/components/site/signup-form'
import { subscribeNewsletter } from '@/app/(site)/actions'
import { NEWSLETTER_CONSENT } from '@/lib/consent'

const PAYMENT_LABELS: Record<string, string> = { mercadopago: 'Mercado Pago', tarjetas: 'Tarjetas', transferencia: 'Transferencia' }

// G-17 to G-24 and CMS-06: newsletter, link columns from the panel, legal
// documents with a published version, the withdrawal button and the
// Ventanilla Única link with their mandated wording, Data Fiscal, active
// payment methods only, and the legal line with the current year.
export async function SiteFooter() {
  const s = await getSettings()
  const legal = await getLegalLinks()
  const dataFiscal = s['company.dataFiscalImage'] ? (await resolveImages(getDb(), [s['company.dataFiscalImage']])).get(s['company.dataFiscalImage']) : undefined
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  const social = [
    s['company.instagram'] && { label: 'Instagram', href: s['company.instagram'] },
    s['company.tiktok'] && { label: 'TikTok', href: s['company.tiktok'] },
    wa && { label: 'WhatsApp', href: wa },
  ].filter(Boolean) as LinkItem[]
  const payments = s['commerce.paymentMethods'].map((m) => PAYMENT_LABELS[m]).filter(Boolean)
  const legalLine = [
    `© ${new Date().getFullYear()} ${s['company.legalName'] || s['brand.fullName']}`,
    s['company.cuit'] && `CUIT ${s['company.cuit']}`,
    s['company.address'],
  ].filter(Boolean)

  return (
    <footer className="mt-24 bg-night-deep text-paper">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.2fr_2fr]">
        <div className="max-w-sm">
          <Wordmark name={s['brand.name']} inverse />
          <p className="mt-4 text-paper/70">{s['brand.tagline']}</p>
          <h2 className="mt-10 font-display text-display-sm">{s['copy.newsletterTitle']}</h2>
          <p className="mt-2 text-sm text-paper/70">{s['copy.newsletterText']}</p>
          <div className="mt-5">
            <SignupForm action={subscribeNewsletter} consent={NEWSLETTER_CONSENT} button="Suscribirme" source="footer" inverse />
          </div>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Comprar" links={s['navigation.footerShop']} />
          <FooterColumn title="Ayuda" links={s['navigation.footerHelp']} />
          <FooterColumn title={s['brand.name']} links={s['navigation.footerAbout']} />
          <FooterColumn
            title="Legales"
            links={[
              ...legal.map((d) => ({ label: d.title, href: `/legales/${d.code}` })),
              { label: 'Botón de arrepentimiento', href: '/arrepentimiento' },
            ]}
          />
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="container-page flex flex-col gap-6 py-8 text-sm text-paper/70 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            {social.length > 0 && (
              <p className="flex flex-wrap gap-4">
                {social.map((l) => (
                  <a key={l.label} href={l.href} className="hover:text-paper" rel="noopener" target="_blank">
                    {l.label}
                  </a>
                ))}
              </p>
            )}
            {payments.length > 0 && <p>Medios de pago: {payments.join(' · ')}</p>}
            <p>{legalLine.join(' · ')}</p>
            {s['company.legalName'] && (
              <p>
                {s['brand.fullName']} es una marca de {s['company.legalName']}.
              </p>
            )}
            {s['company.ventanillaUnicaUrl'] && (
              <p>
                <a href={s['company.ventanillaUnicaUrl']} className="underline underline-offset-2 hover:text-paper" rel="noopener" target="_blank">
                  Defensa de las y los Consumidores. Para reclamos ingrese aquí
                </a>
              </p>
            )}
          </div>
          {dataFiscal && (
            <a href={s['company.dataFiscalUrl'] || undefined} target="_blank" rel="noopener" className="shrink-0">
              <Image src={dataFiscal.src} alt="Data Fiscal" width={64} height={88} className="h-[88px] w-auto bg-paper" />
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  if (!links.length) return null
  return (
    <nav aria-label={title}>
      <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-paper/50">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-paper/85 hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
