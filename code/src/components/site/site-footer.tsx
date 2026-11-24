import Image from 'next/image'
import Link from 'next/link'
import { getSettings, type LinkItem } from '@/server/settings'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { getLegalLinks } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'
import { LogoFull } from '@/components/site/logo'
import { SignupForm } from '@/components/site/signup-form'
import { LanguagePills } from '@/components/site/language-switcher'
import { subscribeNewsletter } from '@/app/(site)/actions'
import { NEWSLETTER_CONSENT } from '@/lib/consent'
import { ArrowUpRight } from '@/components/icons'

const PAYMENT_LABELS: Record<string, string> = { mercadopago: 'Mercado Pago', tarjetas: 'Tarjetas', transferencia: 'Transferencia' }

// G-17 to G-24 and CMS-06, in the approved design's night footer: the brand
// and the newsletter, link columns from the panel, legal documents with a
// published version and the withdrawal button, the brand name as a large
// watermark, and below a hairline the legal line, payment methods, the
// Ventanilla Única link with its mandated wording and Data Fiscal.
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
  const name = s['brand.name']

  return (
    // Warm sand, a light ground of its own, entered through a soft curve.
    <footer className="relative mt-24 text-ink">
      <div className="curved-top tex-linen overflow-hidden bg-sand">
      <div className="container-page relative pb-10 pt-10 md:pt-14">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_2fr] lg:gap-14">
          <div className="max-w-md">
            {/* The client's logotipo, straight on the sand. */}
            <Link href="/" className="inline-block transition-transform duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1">
              <LogoFull alt={s['brand.fullName']} className="w-56 sm:w-64" />
            </Link>
            <p className="mt-3 text-[0.9375rem] font-semibold leading-relaxed text-ink-soft">{s['brand.tagline']}</p>
            <LanguagePills className="mt-7" />
            <h2 className="mt-9 font-display text-[1.45rem] leading-tight">{s['copy.newsletterTitle']}</h2>
            <p className="mt-2 text-[0.9375rem] text-ink-soft">{s['copy.newsletterText']}</p>
            <div className="mt-5">
              <SignupForm action={subscribeNewsletter} consent={NEWSLETTER_CONSENT} button="Suscribirme" source="footer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-8">
            <FooterColumn title="Comprar" links={s['navigation.footerShop']} />
            <FooterColumn title="Ayuda" links={s['navigation.footerHelp']} />
            <FooterColumn title={name} links={s['navigation.footerAbout']} />
            <FooterColumn
              title="Legales"
              links={[...legal.map((d) => ({ label: d.title, href: `/legales/${d.code}` })), { label: 'Botón de arrepentimiento', href: '/arrepentimiento' }]}
            />
          </div>
        </div>

        {/* The brand name as a watermark, as in the design. */}
        <svg aria-hidden="true" focusable="false" viewBox="0 0 1000 190" className="pointer-events-none mt-14 block w-full max-w-5xl select-none text-ink/[0.06]">
          <text x="0" y="158" fill="currentColor" fontFamily="var(--font-display)" fontWeight="800" fontSize="196" letterSpacing="-10" textLength="990" lengthAdjust="spacingAndGlyphs">
            {watermark(name)}
          </text>
        </svg>

        <div className="mt-6 flex flex-col gap-6 border-t border-ink/10 pt-6 text-[0.8125rem] text-ink-muted md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            {social.length > 0 && (
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-ink-soft">
                {social.map((l) => (
                  <a key={l.label} href={l.href} className="inline-flex items-center gap-1 hover:text-ink" rel="noopener" target="_blank">
                    {l.label} <ArrowUpRight size={14} />
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
                <a href={s['company.ventanillaUnicaUrl']} className="underline decoration-ink/30 underline-offset-4 hover:text-ink hover:decoration-ink" rel="noopener" target="_blank">
                  Defensa de las y los Consumidores. Para reclamos ingrese aquí
                </a>
              </p>
            )}
          </div>
          {dataFiscal && (
            <a href={s['company.dataFiscalUrl'] || undefined} target="_blank" rel="noopener" className="shrink-0">
              <Image src={dataFiscal.src} alt="Data Fiscal" width={64} height={88} className="h-[88px] w-auto rounded-md bg-paper" />
            </a>
          )}
        </div>
      </div>
      </div>
    </footer>
  )
}

/** "LaRutina", the second word in the accent colour as the logo sets it. */
function watermark(name: string) {
  const m = /^(La)(.+)$/i.exec(name.replace(/\s+/g, ''))
  if (!m) return name
  return (
    <>
      {m[1]}
      <tspan fill="var(--color-accent)" fillOpacity={0.2}>{m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1)}</tspan>
    </>
  )
}

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  if (!links.length) return null
  return (
    <nav aria-label={title} className="text-[0.9375rem]">
      <h2 className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-ink">{title}</h2>
      <ul className="mt-4 space-y-3 font-medium text-ink-soft">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="hover:text-accent-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
