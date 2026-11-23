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
    <footer className="relative mt-24 overflow-hidden bg-night-deep text-paper">
      <div className="container-page relative pb-10 pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_2fr] lg:gap-14">
          <div className="max-w-sm">
            <Wordmark inverse name={name} markClassName="size-14" />
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-paper/70">{s['brand.tagline']}</p>
            <h2 className="mt-9 font-display text-[1.45rem] leading-tight">{s['copy.newsletterTitle']}</h2>
            <p className="mt-2 text-sm text-paper/70">{s['copy.newsletterText']}</p>
            <div className="mt-5">
              <SignupForm action={subscribeNewsletter} consent={NEWSLETTER_CONSENT} button="Suscribirme" source="footer" inverse />
            </div>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
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
        <svg aria-hidden="true" focusable="false" viewBox="0 0 1000 190" className="pointer-events-none mt-14 block w-full max-w-5xl select-none text-paper/[0.07]">
          <text x="-8" y="160" fill="currentColor" fontFamily="var(--font-display)" fontSize="205" letterSpacing="-8">
            {watermark(name)}
          </text>
        </svg>

        <div className="mt-6 flex flex-col gap-6 border-t border-paper/12 pt-6 text-xs text-paper/55 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            {social.length > 0 && (
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-paper/75">
                {social.map((l) => (
                  <a key={l.label} href={l.href} className="inline-flex items-center gap-1 hover:text-paper" rel="noopener" target="_blank">
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
                <a href={s['company.ventanillaUnicaUrl']} className="underline decoration-paper/40 underline-offset-4 hover:text-paper hover:decoration-paper" rel="noopener" target="_blank">
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
    </footer>
  )
}

/** "LaRutina" with the second word in italic, as the design sets it. */
function watermark(name: string) {
  const m = /^(La)(.+)$/i.exec(name.replace(/\s+/g, ''))
  if (!m) return name
  return (
    <>
      {m[1]}
      <tspan fontStyle="italic">{m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1)}</tspan>
    </>
  )
}

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  if (!links.length) return null
  return (
    <nav aria-label={title} className="text-sm">
      <h2 className="font-medium text-paper">{title}</h2>
      <ul className="mt-4 space-y-3 text-paper/70">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
