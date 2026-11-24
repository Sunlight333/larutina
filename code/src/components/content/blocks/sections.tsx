import Image, { getImageProps } from 'next/image'
import type { ComponentType } from 'react'
import type { BlockDataMap } from '@/server/services/content/blocks'
import { getDb } from '@/server/db'
import { getProductTeasers } from '@/server/services/content/catalog'
import { STEP_LABELS } from '@/server/services/catalog/labels'
import { getSettings } from '@/server/settings'
import { subscribeNewsletter } from '@/app/(site)/actions'
import { NEWSLETTER_CONSENT } from '@/lib/consent'
import { formatARS } from '@/lib/money'
import { lifestyleImage, type LifestyleName } from '@/lib/images'
import type { ResolvedImage } from '@/server/media'
import {
  Award,
  Bulb,
  Chat,
  Check,
  ChevronDown,
  Droplet,
  FaceScan,
  Flask,
  Hand,
  IconBadge,
  Layers,
  Leaf,
  Moon,
  ShieldCheck,
  Sparkle,
  StepIcon,
  Sun,
} from '@/components/icons'
import { ProductImage } from '@/components/catalog/product-image'
import { SignupForm } from '@/components/site/signup-form'
import { Curve } from '@/components/ui/curve'
import { Tilt } from '@/components/ui/tilt'
import { Prose } from '../prose'
import { ProductDot } from '../product-teaser'
import { CtaButton, Lines, lookupImages, SectionHeader, SmartLink, TextLink, type BlockContext } from './shared'

// Editorial blocks of CMS-01, drawn as the sections of the approved design.
// Every text arrives with the copy variables already filled
// (render-blocks.tsx). Where a block has no image of its own, it shows the
// campaign photograph of its section.

type IconComponent = ComponentType<{ size?: number; className?: string }>

const ICONS: Record<string, IconComponent> = {
  diagnostico: FaceScan,
  pasos: Layers,
  idea: Bulb,
  proteccion: ShieldCheck,
  activos: Flask,
  evaluacion: Award,
  uso: Hand,
  manana: Sun,
  noche: Moon,
  natural: Leaf,
  hidratacion: Droplet,
  brillo: Sparkle,
  charla: Chat,
}
const AUTO_ICONS: IconComponent[] = [FaceScan, Layers, Bulb, ShieldCheck, Flask, Award, Hand, Sparkle]
const AUTO_SHOWCASE: IconComponent[] = [Flask, Award, Hand, ShieldCheck, Layers, Bulb, Sparkle, Leaf]

function itemIcon(icon: string, index: number, auto = AUTO_ICONS): IconComponent {
  return ICONS[icon] ?? auto[index % auto.length]!
}

/** The block's own image, or the campaign photograph of the section. */
function pick(img: ResolvedImage | undefined, fallback: LifestyleName) {
  if (img) return { src: img.src, width: img.width, height: img.height, alt: img.alt ?? '', blur: undefined as string | undefined }
  const c = lifestyleImage(fallback)
  return { src: c.src, width: c.width, height: c.height, alt: '', blur: c.blur }
}

const blurProps = (blur: string | undefined) => (blur ? ({ placeholder: 'blur', blurDataURL: blur } as const) : {})

// ------------------------------------------------------------- features ----

export async function FeaturesBlock({ data, ctx }: { data: BlockDataMap['features']; ctx: BlockContext }) {
  if (!data.items.length) return null
  const layout = data.layout === 'auto' ? autoLayout(data) : data.layout
  if (layout === 'moments') return <MomentsSection data={data} />
  if (layout === 'showcase') return <ShowcaseSection data={data} />
  if (layout === 'cards') return <CardsSection data={data} />
  return <IconStrip data={data} ctx={ctx} />
}

/**
 * The style of a block saved as "Automático": two points about the morning and
 * the night get the two photographs; a block about the product page gets the
 * product beside a portrait; anything else, the strip of icons.
 */
function autoLayout(data: BlockDataMap['features']): BlockDataMap['features']['layout'] {
  const said = data.items.map((i) => `${i.icon} ${i.title}`.toLowerCase())
  if (data.items.length === 2 && said.some((t) => /mañana|manana/.test(t)) && said.some((t) => /noche/.test(t))) return 'moments'
  if (/\bficha/i.test(`${data.eyebrow} ${data.title}`)) return 'showcase'
  return 'icons'
}

/** The strip of what the store does, with the icons up front; under the hero it overlaps its curve. */
function IconStrip({ data, ctx }: { data: BlockDataMap['features']; ctx: BlockContext }) {
  const underHero = ctx.prev === 'hero'
  const n = data.items.length
  const cols = n === 2 ? 'lg:grid-cols-2' : n === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
  const hasHeader = !!(data.eyebrow || data.title || data.text)
  return (
    <section className={`container-page relative z-10 ${underHero ? '-mt-12 lg:-mt-20' : 'mt-20 md:mt-28'}`} aria-label={hasHeader ? undefined : data.title || 'Lo que hacemos'}>
      {hasHeader && (
        <div className="mb-10">
          <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
        </div>
      )}
      <ul className={`grid grid-cols-2 gap-2 rounded-[1.5rem_3rem_1.5rem_3rem] bg-paper p-2 shadow-[var(--shadow-float)] ring-1 ring-line/70 lg:gap-0 lg:p-3 ${cols}`}>
        {data.items.map((item, i) => {
          const I = itemIcon(item.icon, i)
          return (
            <li
              key={item._id}
              data-reveal="up"
              style={{ '--i': i } as React.CSSProperties}
              className={`flex flex-col gap-3 rounded-[1.5rem] p-4 lg:flex-row lg:items-center lg:gap-4 lg:rounded-none lg:p-5 ${i % 4 > 0 ? 'lg:border-l lg:border-line' : ''}`}
            >
              <IconBadge size="lg">
                <I size={24} />
              </IconBadge>
              <div>
                <p className="text-base font-bold leading-snug tracking-[-0.01em]">{item.title}</p>
                {item.text && <p className="mt-1 text-[0.875rem] leading-snug text-ink-muted">{item.text}</p>}
              </div>
            </li>
          )
        })}
      </ul>
      {!hasHeader && data.ctaLabel && data.ctaHref && (
        <div className="mt-6">
          <TextLink label={data.ctaLabel} href={data.ctaHref} />
        </div>
      )}
    </section>
  )
}

// The steps a morning and a night routine take, in order: what the chips on
// each photograph show.
const MOMENT_STEPS = {
  AM: ['CLEANSER', 'TONER', 'SERUM', 'MOISTURIZER', 'SUNSCREEN'],
  PM: ['CLEANSER', 'EXFOLIANT', 'TREATMENT', 'MOISTURIZER'],
} as const

/** Morning and night: two moods, two leaf-cornered photographs. The first point is the morning, the second the night. */
async function MomentsSection({ data }: { data: BlockDataMap['features'] }) {
  const imgs = await lookupImages(data.items.map((i) => i.image))
  return (
    <section className="defer-render container-page mt-20 md:mt-28" aria-labelledby={data.title ? `momentos-${data.items[0]!._id}` : undefined}>
      <div className="mx-auto max-w-2xl text-center">
        {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
        {data.title && (
          <h2 id={`momentos-${data.items[0]!._id}`} className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>
            {data.title}
          </h2>
        )}
        {data.text && <p className="mt-5 text-lede text-ink-soft">{data.text}</p>}
      </div>
      <div className={`grid gap-6 lg:grid-cols-2 lg:gap-8 ${data.eyebrow || data.title || data.text ? 'mt-12' : ''}`}>
        {data.items.map((item, i) => {
          const night = item.icon === 'noche' || (item.icon !== 'manana' && i % 2 === 1)
          const img = pick(imgs.get(item.image), night ? 'noche' : 'manana')
          const steps = MOMENT_STEPS[night ? 'PM' : 'AM']
          return (
            <article
              key={item._id}
              data-reveal="up"
              style={{ '--i': i } as React.CSSProperties}
              className={`relative flex min-h-[34rem] flex-col justify-end overflow-hidden p-6 text-paper sm:min-h-[38rem] sm:p-10 ${i % 2 === 0 ? 'shape-leaf' : 'shape-leaf-alt lg:mt-20'}`}
            >
              <Image src={img.src} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" {...blurProps(img.blur)} className="object-cover object-top" />
              <div className={`absolute inset-0 bg-linear-to-t to-transparent ${night ? 'from-night-deep/95 via-night-deep/40 via-45%' : 'from-ink/85 via-ink/30 via-45%'}`} />
              <div className="relative">
                <IconBadge size="lg" tone="night">
                  {night ? <Moon size={24} /> : <Sun size={26} />}
                </IconBadge>
                <h3 className="mt-5 font-display text-display-md">{item.title}</h3>
                {item.text && <Lines text={item.text} className="mt-2 max-w-sm text-paper/80" />}
                <ol className="mt-6 flex flex-wrap gap-2" aria-label="Pasos">
                  {steps.map((s, n) => (
                    <li key={s} className="inline-flex items-center gap-2 rounded-full bg-ink/35 py-1.5 pl-1.5 pr-3.5 text-sm ring-1 ring-paper/20">
                      <span className="tabular grid size-6 place-items-center rounded-full bg-paper text-[0.75rem] font-medium text-ink">{n + 1}</span>
                      <StepIcon type={s} size={16} />
                      {STEP_LABELS[s]}
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          )
        })}
      </div>
      {data.ctaLabel && data.ctaHref && (
        <div className="mt-10 flex justify-center">
          <CtaButton label={data.ctaLabel} href={data.ctaHref} variant="secondary" />
        </div>
      )}
    </section>
  )
}

/** "Así se ve una ficha": the campaign portrait in a soft blob, the product beside it, and the points of a product page. */
async function ShowcaseSection({ data }: { data: BlockDataMap['features'] }) {
  const codes = data.productCodes.length ? data.productCodes : (await getSettings())['listing.featured'].slice(0, 1)
  const [imgs, products] = await Promise.all([lookupImages([data.image]), getProductTeasers(getDb(), codes)])
  const product = products[0]
  const img = pick(imgs.get(data.image), 'ficha')
  const first = data.items[0]!
  const FirstIcon = itemIcon(first.icon, 0, AUTO_SHOWCASE)
  return (
    <section className="container-page mt-24 grid items-center gap-16 md:mt-36 lg:grid-cols-2 lg:gap-20" aria-labelledby={`ficha-${first._id}`}>
      <div className="relative mx-auto w-full max-w-md lg:max-w-none">
        <div data-reveal="clip" className="shape-blob relative aspect-[4/5] overflow-hidden bg-sand">
          <Image src={img.src} alt={data.imageAlt || img.alt} fill sizes="(min-width: 1024px) 560px, 90vw" {...blurProps(img.blur)} className="object-cover" />
        </div>
        {product && (
          <SmartLink
            href={product.href}
            className="shape-arch absolute -bottom-10 -right-2 block w-32 overflow-hidden shadow-[0_30px_50px_-24px_rgb(40_30_20/0.55)] ring-[6px] ring-paper transition-transform hover:-translate-y-1 sm:-right-6 sm:w-44"
          >
            <span className="sr-only">Ver {product.name}</span>
            <ProductImage image={product.image} alt="" step={product.routineStep} sizes="176px" />
          </SmartLink>
        )}
        <div aria-hidden="true" className="animate-float absolute -left-2 top-6 flex max-w-[17rem] items-center gap-3 rounded-full bg-paper py-2 pl-2 pr-5 shadow-[var(--shadow-float)] ring-1 ring-line/60 sm:-left-6">
          <IconBadge size="md">
            <FirstIcon size={22} />
          </IconBadge>
          <span className="min-w-0">
            <span className="block text-[0.75rem] text-ink-muted">En cada ficha</span>
            <span className="block truncate font-display text-[1.15rem] leading-tight">{first.title}</span>
          </span>
        </div>
      </div>
      <div>
        {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
        <h2 id={`ficha-${first._id}`} className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>
          {data.title}
        </h2>
        {data.text && <p className="mt-5 max-w-lg whitespace-pre-line text-lede text-ink-soft">{data.text}</p>}
        <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {data.items.map((item, i) => {
            const I = itemIcon(item.icon, i, AUTO_SHOWCASE)
            return (
              <li key={item._id} className="flex gap-4">
                <IconBadge>
                  <I size={22} />
                </IconBadge>
                <div>
                  <p className="font-medium">{item.title}</p>
                  {item.text && <p className="mt-0.5 text-sm leading-snug text-ink-muted">{item.text}</p>}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          {product ? (
            <>
              <CtaButton label={data.ctaLabel || 'Ver la ficha completa'} href={product.href} />
              <p className="text-sm text-ink-muted">
                {product.name}
                {product.priceCents != null && (
                  <>
                    {' '}
                    · <span className="tabular">{formatARS(product.priceCents)}</span>
                  </>
                )}
              </p>
            </>
          ) : (
            <CtaButton label={data.ctaLabel} href={data.ctaHref} />
          )}
        </div>
      </div>
    </section>
  )
}

async function CardsSection({ data }: { data: BlockDataMap['features'] }) {
  const imgs = await lookupImages(data.items.map((i) => i.image))
  const cols = data.items.length === 2 ? 'md:grid-cols-2' : data.items.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
  return (
    <section className="container-page mt-20 md:mt-28">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className={`grid gap-4 ${cols} ${data.title || data.eyebrow || data.text ? 'mt-10' : ''}`}>
        {data.items.map((item, i) => {
          const img = imgs.get(item.image)
          const I = itemIcon(item.icon, i)
          return (
            <li key={item._id} className="rounded-[2rem] bg-shell p-6">
              {img ? (
                <div className="shape-arch relative -mx-2 -mt-2 mb-5 aspect-[4/5] overflow-hidden bg-sand">
                  <Image src={img.src} alt={img.alt ?? ''} fill sizes="(min-width: 64rem) 30vw, 90vw" className="object-cover" />
                </div>
              ) : (
                <IconBadge size="lg" tone="paper">
                  <I size={24} />
                </IconBadge>
              )}
              <h3 className={`font-display text-[1.375rem] leading-tight ${img ? '' : 'mt-5'}`}>{item.title}</h3>
              {item.text && <Lines text={item.text} className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft" />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ------------------------------------------------------------- carousel ----

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
    <section className="mt-20 md:mt-28" aria-label={label}>
      <div className="container-page">
        <SectionHeader eyebrow={data.eyebrow} title={data.title} />
      </div>
      {/* A native scroll-snap row: swipe on phones, scroll or Tab on desktop; no script needed. */}
      <ul className={`scroller flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-[max(2rem,calc((100vw-72rem)/2))] ${data.title || data.eyebrow ? 'mt-10' : ''}`} tabIndex={0} aria-label={label}>
        {slides.map((s, i) => {
          const sizes = '(min-width: 64rem) 36rem, 85vw'
          const { props: d } = getImageProps({ src: s.desktop.src, width: s.desktop.width, height: s.desktop.height, alt: s.alt, sizes })
          const { props: m } = getImageProps({ src: s.mobile.src, width: s.mobile.width, height: s.mobile.height, alt: s.alt, sizes })
          const figure = (
            <figure>
              <div className={`relative aspect-[4/5] overflow-hidden bg-sand md:aspect-[4/3] ${i % 2 ? 'shape-leaf-alt' : 'shape-leaf'}`}>
                <picture>
                  <source media="(min-width: 48rem)" srcSet={d.srcSet} sizes={sizes} />
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from the props */}
                  <img {...m} className="absolute inset-0 h-full w-full object-cover" />
                </picture>
              </div>
              {s.text && <figcaption className="mt-3 px-1 text-[0.9375rem] text-ink-soft">{s.text}</figcaption>}
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

// ---------------------------------------------------------- image + text ----

/** The campaign's still life: a full-width photograph with the text over its light side, and the products in it. */
export async function ImageTextBlock({ data }: { data: BlockDataMap['imageText'] }) {
  const [imgs, products] = await Promise.all([lookupImages([data.image]), getProductTeasers(getDb(), data.productCodes)])
  const img = pick(imgs.get(data.image), 'bodegon')
  const own = imgs.has(data.image)
  const textLeft = data.imageSide !== 'left'
  return (
    <section className="defer-render relative mt-16 md:mt-24">
      <div className="relative isolate overflow-hidden bg-sand">
        <Curve outside className="absolute inset-x-0 top-0 z-10 text-paper" />
        <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[44rem]">
          <Image
            src={img.src}
            alt={data.imageAlt || img.alt}
            fill
            sizes="100vw"
            {...blurProps(img.blur)}
            className={`object-cover ${own ? '' : 'object-[86%_center] sm:object-[80%_center] lg:object-[62%_center]'} ${textLeft || own ? '' : '-scale-x-100'}`}
          />
          <div
            className={`absolute inset-0 hidden lg:block ${textLeft ? 'bg-linear-to-r' : 'bg-linear-to-l'} from-paper/75 via-paper/35 via-40% to-paper/0 to-60%`}
          />
        </div>
        <div className="relative bg-paper lg:absolute lg:inset-0 lg:flex lg:items-center lg:bg-transparent">
          <div className={`container-page py-12 lg:flex lg:py-0 ${textLeft ? '' : 'lg:justify-end'}`}>
            <div className="max-w-lg">
              {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
              {data.title && <h2 className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
              {data.body && <Prose source={data.body} className="mt-5 text-lede text-ink-soft" />}
              {(products.length > 0 || (data.ctaLabel && data.ctaHref)) && (
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
                  {products.length > 0 && (
                    <ul className="flex -space-x-2.5" aria-label="Productos en la foto">
                      {products.map((p) => (
                        <li key={p.code}>
                          <SmartLink href={p.href} className="relative block rounded-full ring-[3px] ring-paper transition-transform hover:z-10 hover:-translate-y-1">
                            <span className="sr-only">
                              {p.brand}, {p.name}
                            </span>
                            <ProductDot product={p} />
                          </SmartLink>
                        </li>
                      ))}
                    </ul>
                  )}
                  <TextLink label={data.ctaLabel} href={data.ctaHref} />
                </div>
              )}
            </div>
          </div>
        </div>
        <Curve outside flip className="absolute inset-x-0 bottom-0 z-10 hidden text-paper lg:block" />
      </div>
    </section>
  )
}

// ------------------------------------------------------------ diagnosis ----

/** A question of the diagnosis as it looks on the phone, and the routine it ends in, over a campaign portrait. Static and decorative. */
function DiagnosisPortrait({ total }: { total: number }) {
  const img = lifestyleImage('diagnostico')
  const pct = Math.round((3 / total) * 100)
  return (
    <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none">
      <div data-reveal="clip" className="shape-arch relative aspect-[4/5] overflow-hidden bg-sand">
        <Image src={img.src} alt="" fill sizes="(min-width: 1024px) 480px, 90vw" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
      </div>
      <div
        aria-hidden="true"
        className="animate-float absolute -right-2 bottom-[27%] w-[13.5rem] rounded-[1.25rem_2.5rem_1.25rem_2.5rem] bg-paper p-4 shadow-[var(--shadow-float)] ring-1 ring-line/60 sm:-right-10 sm:bottom-auto sm:top-[14%] sm:w-[15.5rem]"
      >
        <div className="flex items-center justify-between text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-muted">
          <span>
            Pregunta 3 de {total}
          </span>
          <span className="tabular">{pct}%</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3.5 font-display text-[1.2rem] leading-tight">¿Qué te gustaría mejorar?</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[0.75rem]">
          <span className="inline-flex items-center gap-1 rounded-full bg-ink py-1.5 pl-2 pr-3 text-paper">
            <Check size={13} /> Manchas
          </span>
          <span className="rounded-full px-3 py-1.5 ring-1 ring-line-strong">Poros y brillo</span>
          <span className="rounded-full px-3 py-1.5 ring-1 ring-line-strong">Rojeces</span>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="animate-float-slow absolute -left-2 bottom-[4%] flex items-center gap-3 rounded-full bg-paper py-2.5 pl-2.5 pr-5 shadow-[var(--shadow-float)] ring-1 ring-line/60 sm:-left-10 sm:bottom-[9%]"
      >
        <IconBadge size="md">
          <Sparkle size={22} />
        </IconBadge>
        <span>
          <span className="block text-[0.75rem] text-ink-muted">Tu rutina está lista</span>
          <span className="mt-0.5 flex items-center gap-2 text-[0.9375rem] font-medium">
            <Sun size={15} /> Mañana <span className="text-line-strong">·</span> <Moon size={14} /> Noche
          </span>
        </span>
      </div>
    </div>
  )
}

/** A shell band with soft curves above and below, for the diagnosis sections. */
function ShellBand({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <section className="defer-render relative mt-16 md:mt-20" aria-labelledby={label}>
      <div className="curved-band tex-linen bg-shell">{children}</div>
    </section>
  )
}

export function DiagnosisBlock({ data, ctx }: { data: BlockDataMap['diagnosis']; ctx: BlockContext }) {
  const label = data.ctaLabel || 'Hacer mi diagnóstico'
  const href = data.ctaHref || '/diagnostico'
  if (data.variant === 'dark') {
    // H-26: the closing call, on the night campaign, in a pale dusk band of its
    // own, curved at both edges, so it never merges with the footer below.
    // The friends under the arch in the evening light: the morning-and-night block already shows the night portrait.
    const night = lifestyleImage('hero-3-phone')
    return (
      <section className="relative mt-16 md:mt-24">
        <div className="curved-band tex-plaster relative bg-night-soft text-ink">
          <div className="container-page relative grid items-center gap-14 pb-16 pt-12 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:pb-20">
            <div className="max-w-xl">
              <IconBadge size="lg" tone="paper" className="text-night">
                <Moon size={24} />
              </IconBadge>
              {data.eyebrow && <p className="eyebrow mt-6">{data.eyebrow}</p>}
              <h2 className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : 'mt-6'}`}>{data.title}</h2>
              {data.text && <p className="mt-5 max-w-md whitespace-pre-line text-lede text-ink-soft">{data.text}</p>}
              <CtaButton label={label} href={href} size="lg" className="mt-9" />
            </div>
            <div className="relative mx-auto w-full max-w-[22rem] lg:mr-0 lg:max-w-[26rem]">
              <div data-reveal="clip" className="shape-arch relative aspect-[4/5] overflow-hidden shadow-[var(--shadow-float)] ring-[6px] ring-paper">
                <Image src={night.src} alt="" fill sizes="(min-width: 1024px) 416px, 352px" placeholder="blur" blurDataURL={night.blur} className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }
  // H-13: what a question of the diagnosis looks like, beside the invitation.
  const total = Number(ctx.vars.preguntas) || 8
  return (
    <ShellBand>
      <div className="container-page grid gap-16 py-14 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-24">
        <DiagnosisPortrait total={total} />
        <div>
          {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
          <h2 className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title || 'Tu rutina, en unos minutos'}</h2>
          {data.text && <p className="mt-5 max-w-md whitespace-pre-line text-lede text-ink-soft">{data.text}</p>}
          <CtaButton label={label} href={href} className="mt-9" />
        </div>
      </div>
    </ShellBand>
  )
}

const HOW_ICONS: IconComponent[] = [FaceScan, Layers, Bulb, Sparkle, ShieldCheck, Hand]

/**
 * How it works: the steps as a path on the linen band. A terracotta thread
 * runs through them; each step is a leaf-cornered paper card that rises a
 * little further along the path, with its number large in the corner and its
 * icon lifted on a dark badge. The cards lean towards the pointer.
 */
export function HowItWorksBlock({ data }: { data: BlockDataMap['howItWorks']; ctx: BlockContext }) {
  if (!data.steps.length) return null
  const n = data.steps.length
  const cols = n === 2 ? 'md:grid-cols-2' : n === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'
  // The thread climbs with the cards (each sits 2.5 rem higher than the last).
  const lift = (i: number) => ({ '--i': i, '--lift': `${i * 2.5}rem` }) as React.CSSProperties
  return (
    <ShellBand>
      <div className="container-page py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
          {data.title && <h2 className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
          {data.text && <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-lede text-ink-soft">{data.text}</p>}
        </div>
        <div className="relative mt-14 md:mt-16">
          {n > 1 && (
            <svg aria-hidden="true" viewBox="0 0 1200 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[6%] top-1/2 hidden h-40 w-[88%] -translate-y-1/2 text-accent md:block">
              <path d="M0 140 C 260 150, 340 40, 600 80 S 960 10, 1200 20" pathLength={1} className="animate-draw" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="0.012 0.012" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <ol className={`relative grid gap-5 md:items-end md:gap-6 ${cols}`}>
            {data.steps.map((s, i) => {
              const I = HOW_ICONS[i % HOW_ICONS.length]!
              return (
                <li key={s._id} data-reveal="up" style={lift(i)} className="md:mb-[var(--lift)]">
                  <Tilt max={5} className={`relative h-full bg-paper p-6 pt-7 shadow-[var(--shadow-lift)] ring-1 ring-line/70 sm:p-8 ${i % 2 ? 'rounded-[1.25rem_3.5rem_1.25rem_3.5rem]' : 'rounded-[3.5rem_1.25rem_3.5rem_1.25rem]'}`}>
                    <span aria-hidden="true" className="tabular pointer-events-none absolute right-6 top-3 font-display text-[4.5rem] font-extrabold leading-none tracking-[-0.05em] text-accent/20">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="tilt-layer relative block w-fit">
                      <IconBadge size="xl" tone="ink">
                        <I size={30} />
                      </IconBadge>
                    </span>
                    <h3 className="mt-6 font-display text-[1.375rem] leading-tight">
                      <span className="sr-only">Paso {i + 1}: </span>
                      {s.title}
                    </h3>
                    {s.text && <Lines text={s.text} className="mt-2 text-[0.9875rem] leading-relaxed text-ink-soft" />}
                  </Tilt>
                </li>
              )
            })}
          </ol>
        </div>
        {data.ctaLabel && data.ctaHref && (
          <div className="mt-12 flex justify-center">
            <CtaButton label={data.ctaLabel} href={data.ctaHref} />
          </div>
        )}
      </div>
    </ShellBand>
  )
}

// ------------------------------------------------------- text and lists ----

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
        <div className={`space-y-3 ${data.title ? 'mt-6' : ''}`}>
          {data.items.map((item) => (
            <details key={item._id} className="group rounded-[1.75rem] border border-line bg-paper open:bg-shell/60">
              <summary className="flex items-center justify-between gap-4 px-5 py-4 text-left text-[1.0625rem] font-medium">
                {item.question}
                <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
              </summary>
              <Prose source={item.answer} className="px-5 pb-5" />
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
    <section className="container-page mt-20 md:mt-28">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} />
      <ul className={`grid gap-4 md:grid-cols-3 ${data.title || data.eyebrow ? 'mt-10' : ''}`}>
        {data.items.map((t) => (
          <li key={t._id}>
            <figure className="h-full rounded-[1.75rem] bg-shell p-6">
              <IconBadge size="sm" tone="paper">
                <Chat size={17} />
              </IconBadge>
              <blockquote className="mt-4 font-display text-[1.35rem] leading-snug">“{t.quote}”</blockquote>
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
  const img = pick((await lookupImages([data.image])).get(data.image), 'manana')
  return (
    <section className="container-page mt-20 md:mt-28">
      <div className="grid items-center gap-10 rounded-[2rem] bg-shell p-4 md:grid-cols-[0.8fr_1fr] md:p-6 lg:gap-16">
        <div className="shape-leaf relative aspect-[4/3] overflow-hidden bg-sand md:aspect-[4/5]">
          <Image src={img.src} alt={data.imageAlt || img.alt} fill sizes="(min-width: 48rem) 30rem, 92vw" {...blurProps(img.blur)} className="object-cover" />
        </div>
        <div className="px-2 pb-6 md:py-6 md:pr-8">
          {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
          <h2 className={`font-display text-display-lg text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>
          {data.text && <Lines text={data.text} className="mt-5 text-lede text-ink-soft" />}
          {data.ctaLabel && data.ctaHref && (
            <div className="mt-8">
              <CtaButton label={data.ctaLabel} href={data.ctaHref} />
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
    <section className="container-page mt-20 md:mt-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center rounded-[2rem] bg-shell px-6 py-12 text-center md:px-12">
        <IconBadge size="lg">
          <Sparkle size={24} />
        </IconBadge>
        <h2 className="mt-5 font-display text-display-md text-balance">{data.title || s['copy.newsletterTitle']}</h2>
        <p className="mt-3 max-w-lg text-ink-soft">{data.text || s['copy.newsletterText']}</p>
        <div className="mt-7 w-full max-w-md text-left">
          <SignupForm action={subscribeNewsletter} consent={NEWSLETTER_CONSENT} button="Suscribirme" source={ctx.pageSlug === 'inicio' ? 'home' : ctx.pageSlug} />
        </div>
      </div>
    </section>
  )
}

