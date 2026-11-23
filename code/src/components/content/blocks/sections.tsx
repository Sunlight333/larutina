import Image, { getImageProps } from 'next/image'
import type { BlockDataMap } from '@/server/services/content/blocks'
import { getDb } from '@/server/db'
import { getProductTeasers } from '@/server/services/content/catalog'
import { getSettings } from '@/server/settings'
import { subscribeNewsletter } from '@/app/(site)/actions'
import { NEWSLETTER_CONSENT } from '@/lib/consent'
import { ChevronDown } from '@/components/icons'
import { SignupForm } from '@/components/site/signup-form'
import { Prose } from '../prose'
import { ProductChip } from '../product-teaser'
import { CtaButton, Lines, lookupImages, SectionHeader, SmartLink, TextLink, type BlockContext } from './shared'

// Editorial blocks of CMS-01. Every text arrives with the copy variables
// already filled (render-blocks.tsx).

export async function CarouselBlock({ data }: { data: BlockDataMap['carousel'] }) {
  const imgs = await lookupImages(data.slides.flatMap((s) => [s.imageDesktop, s.imageMobile]))
  const slides = data.slides.flatMap((s) => {
    const desktop = imgs.get(s.imageDesktop) ?? imgs.get(s.imageMobile)
    const mobile = imgs.get(s.imageMobile) ?? desktop
    return desktop && mobile ? [{ ...s, desktop, mobile }] : []
  })
  if (!slides.length) return null
  const label = data.title || data.eyebrow || 'Fotos'
  return (
    <section className="py-12 md:py-16" aria-label={label}>
      <div className="container-page">
        <SectionHeader eyebrow={data.eyebrow} title={data.title} />
      </div>
      {/* A native scroll-snap row: swipe on phones, scroll or Tab on desktop; no script needed. */}
      <ul className={`scroller flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-[max(2rem,calc((100vw-72rem)/2))] ${data.title || data.eyebrow ? 'mt-8' : ''}`} tabIndex={0} aria-label={label}>
        {slides.map((s, i) => {
          const sizes = '(min-width: 64rem) 36rem, 85vw'
          const { props: d } = getImageProps({ src: s.desktop.src, width: s.desktop.width, height: s.desktop.height, alt: s.alt, sizes })
          const { props: m } = getImageProps({ src: s.mobile.src, width: s.mobile.width, height: s.mobile.height, alt: s.alt, sizes })
          const figure = (
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-sand md:aspect-[4/3]">
                <picture>
                  <source media="(min-width: 48rem)" srcSet={d.srcSet} sizes={sizes} />
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from the props */}
                  <img {...m} className="absolute inset-0 h-full w-full object-cover" />
                </picture>
              </div>
              {s.text && <figcaption className="mt-3 text-[0.9375rem] text-ink-soft">{s.text}</figcaption>}
            </figure>
          )
          return (
            <li key={s._id} className="w-[85vw] max-w-[36rem] shrink-0" aria-label={`${i + 1} de ${slides.length}`}>
              {s.href ? (
                <SmartLink href={s.href} className="block">
                  {figure}
                </SmartLink>
              ) : (
                figure
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export async function FeaturesBlock({ data }: { data: BlockDataMap['features'] }) {
  if (!data.items.length) return null
  const imgs = await lookupImages(data.items.map((i) => i.image))
  const cols = data.items.length === 2 ? 'md:grid-cols-2' : data.items.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
  return (
    <section className="container-page py-12 md:py-16">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className={`grid gap-4 ${cols} ${data.title || data.eyebrow || data.text ? 'mt-10' : ''}`}>
        {data.items.map((item) => {
          const img = imgs.get(item.image)
          return (
            <li key={item._id} className="rounded-[var(--radius-card)] bg-shell p-6">
              {img && (
                <div className="relative -mx-2 -mt-2 mb-5 aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                  <Image src={img.src} alt={img.alt ?? ''} fill sizes="(min-width: 64rem) 30vw, 90vw" className="object-cover" />
                </div>
              )}
              <h3 className="font-display text-[1.375rem] leading-tight">{item.title}</h3>
              {item.text && <Lines text={item.text} className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft" />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export async function ImageTextBlock({ data }: { data: BlockDataMap['imageText'] }) {
  const [imgs, products] = await Promise.all([lookupImages([data.image]), getProductTeasers(getDb(), data.productCodes)])
  const img = imgs.get(data.image)
  return (
    <section className="container-page py-12 md:py-20">
      <div className={`grid items-center gap-10 ${img ? 'lg:grid-cols-2 lg:gap-16' : ''}`}>
        {img && (
          <div className={`relative aspect-[4/3] overflow-hidden bg-sand shape-leaf ${data.imageSide === 'right' ? 'lg:order-2' : ''}`}>
            <Image src={img.src} alt={data.imageAlt || img.alt || ''} fill sizes="(min-width: 64rem) 36rem, 92vw" className="object-cover" />
          </div>
        )}
        <div className="max-w-xl">
          {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
          {data.title && <h2 className={`font-display text-display-md text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
          {data.body && <Prose source={data.body} className="mt-5 text-lede" />}
          {products.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Productos en la foto">
              {products.map((p) => (
                <li key={p.code}>
                  <ProductChip product={p} />
                </li>
              ))}
            </ul>
          )}
          {data.ctaLabel && data.ctaHref && (
            <div className="mt-8">
              <TextLink label={data.ctaLabel} href={data.ctaHref} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function DiagnosisBlock({ data, ctx }: { data: BlockDataMap['diagnosis']; ctx: BlockContext }) {
  const label = data.ctaLabel || 'Hacer mi diagnóstico'
  const href = data.ctaHref || '/diagnostico'
  if (data.variant === 'dark') {
    // H-26: the only dark block of the Home.
    return (
      <section className="mt-12 bg-night-deep text-paper">
        <div className="container-page py-16 text-center md:py-24">
          {data.eyebrow && <p className="eyebrow text-paper/60">{data.eyebrow}</p>}
          <h2 className={`mx-auto max-w-3xl font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>
          {data.text && <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-lede text-paper/75">{data.text}</p>}
          <div className="mt-8 flex justify-center">
            <CtaButton label={label} href={href} variant="inverse" size="lg" />
          </div>
        </div>
      </section>
    )
  }
  const total = Number(ctx.vars.preguntas) || 8
  // H-13: what a question of the diagnosis looks like. Static, so it never
  // moves for someone who asked for reduced motion and costs no script.
  const hasText = !!(data.eyebrow || data.title || data.text)
  return (
    <section className="bg-shell">
      <div className={`container-page grid items-center gap-12 py-14 md:py-20 ${hasText ? 'lg:grid-cols-2' : ''}`}>
        {hasText ? (
          <div className="max-w-xl">
            {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
            {data.title && <h2 className={`font-display text-display-md text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
            {data.text && <p className="mt-5 whitespace-pre-line text-lede text-ink-soft">{data.text}</p>}
            <div className="mt-8">
              <CtaButton label={label} href={href} size="lg" />
            </div>
          </div>
        ) : (
          <div className="order-2 flex justify-center">
            <CtaButton label={label} href={href} size="lg" />
          </div>
        )}
        <div className="mx-auto w-full max-w-sm">
          <div aria-hidden="true" className="rounded-[1.75rem] bg-paper p-6 shadow-[0_30px_60px_-30px_rgb(40_30_20/0.45)] ring-1 ring-line/60">
            <div className="flex items-center justify-between text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-muted">
              <span>Pregunta 3 de {total}</span>
              <span className="tabular">{Math.round((3 / total) * 100)}%</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((3 / total) * 100)}%` }} />
            </div>
            <p className="mt-5 font-display text-xl">¿Qué te gustaría mejorar?</p>
            <ul className="mt-4 space-y-2 text-sm">
              {['Manchas o tono desparejo', 'Poros y brillo', 'Líneas finas y firmeza'].map((o, i) => (
                <li key={o} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${i === 0 ? 'border-ink bg-shell font-medium' : 'border-line'}`}>
                  <span className={`size-4 rounded-full border ${i === 0 ? 'border-[5px] border-ink' : 'border-line-strong'}`} />
                  {o}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-xl bg-sage-soft px-3 py-2.5 text-sm font-medium text-sage-ink">Tu rutina está lista.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HowItWorksBlock({ data }: { data: BlockDataMap['howItWorks'] }) {
  if (!data.steps.length) return null
  return (
    <section className="container-page py-12 md:py-20">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} />
      <ol className={`grid gap-8 md:grid-cols-3 ${data.title || data.text ? 'mt-10' : ''}`}>
        {data.steps.map((s, i) => (
          <li key={s._id} className="border-t border-line-strong pt-5">
            <span className="font-display text-display-sm text-accent-ink tabular" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
            {s.text && <Lines text={s.text} className="mt-2 leading-relaxed text-ink-soft" />}
          </li>
        ))}
      </ol>
      {data.ctaLabel && data.ctaHref && (
        <div className="mt-10">
          <CtaButton label={data.ctaLabel} href={data.ctaHref} />
        </div>
      )}
    </section>
  )
}

export function RichTextBlock({ data }: { data: BlockDataMap['richText'] }) {
  return (
    <section className="container-page py-8 md:py-10">
      <div className="max-w-2xl">
        {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
        {data.title && <h2 className={`font-display text-display-sm text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
        <Prose source={data.body} className={`text-[1.0625rem] ${data.title ? 'mt-4' : ''}`} />
      </div>
    </section>
  )
}

export function FaqBlock({ data }: { data: BlockDataMap['faq'] }) {
  if (!data.items.length) return null
  return (
    <section className="container-page py-8 md:py-10">
      <div className="max-w-3xl">
        {data.title && <h2 className="font-display text-display-sm text-balance">{data.title}</h2>}
        <div className={`divide-y divide-line border-y border-line ${data.title ? 'mt-6' : ''}`}>
          {data.items.map((item) => (
            <details key={item._id} className="group py-1">
              <summary className="flex items-center justify-between gap-4 py-4 text-left text-[1.0625rem] font-medium">
                {item.question}
                <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
              </summary>
              <Prose source={item.answer} className="pb-5" />
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TestimonialsBlock({ data }: { data: BlockDataMap['testimonials'] }) {
  if (!data.items.length) return null
  return (
    <section className="container-page py-12 md:py-16">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} />
      <ul className={`grid gap-4 md:grid-cols-3 ${data.title || data.eyebrow ? 'mt-10' : ''}`}>
        {data.items.map((t) => (
          <li key={t._id}>
            <figure className="h-full rounded-[var(--radius-card)] border border-line p-6">
              <blockquote className="font-display text-xl leading-snug">“{t.quote}”</blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-medium">{t.name}</span>
                {t.detail && <span className="text-ink-muted"> · {t.detail}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function AmbassadorsBlock({ data }: { data: BlockDataMap['ambassadors'] }) {
  const img = (await lookupImages([data.image])).get(data.image)
  return (
    <section className="container-page py-12 md:py-16">
      <div className={`grid items-center gap-8 overflow-hidden rounded-[var(--radius-card)] bg-sand ${img ? 'md:grid-cols-2' : ''}`}>
        {img && (
          <div className="relative aspect-[4/3] h-full">
            <Image src={img.src} alt={data.imageAlt || img.alt || ''} fill sizes="(min-width: 48rem) 36rem, 92vw" className="object-cover" />
          </div>
        )}
        <div className="p-8 md:p-12">
          {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
          <h2 className={`font-display text-display-md text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>
          {data.text && <Lines text={data.text} className="mt-4 text-lede text-ink-soft" />}
          {data.ctaLabel && data.ctaHref && (
            <div className="mt-8">
              <CtaButton label={data.ctaLabel} href={data.ctaHref} variant="secondary" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export async function NewsletterBlock({ data, ctx }: { data: BlockDataMap['newsletter']; ctx: BlockContext }) {
  const s = await getSettings()
  return (
    <section className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] bg-accent-soft px-6 py-10 text-center md:px-12">
        <h2 className="font-display text-display-sm text-balance">{data.title || s['copy.newsletterTitle']}</h2>
        <p className="mt-3 text-ink-soft">{data.text || s['copy.newsletterText']}</p>
        <div className="mx-auto mt-6 max-w-md text-left">
          <SignupForm action={subscribeNewsletter} consent={NEWSLETTER_CONSENT} button="Suscribirme" source={ctx.pageSlug === 'inicio' ? 'home' : ctx.pageSlug} />
        </div>
      </div>
    </section>
  )
}
