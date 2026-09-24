'use client'

import Image, { getImageProps } from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowUpRight } from '@/components/icons'

export type HeroProduct = {
  href: string
  name: string
  brand: string
  price: string
  thumb: string
  color: string
  /** Where the hotspot sits in the photo, beside the product, as fractions of its width and height. */
  spot: [number, number]
  /** Which side of the hotspot the preview card opens on, away from the product and the faces. */
  card: 'left' | 'right' | 'above' | 'below'
}

export type HeroSlide = {
  src: string
  width: number
  height: number
  /** The 4:5 crop phones load instead, and where it sits in the wide image (fractions of its width). */
  phone: { src: string; width: number; height: number; crop: { left: number; width: number } }
  alt: string
  title: string
  /** object-position of the wide image as fractions: tablets frame the group, desktop keeps the left half for the headline. */
  focus: { tablet: [number, number]; desktop: [number, number] }
  products: HeroProduct[]
}

const INTERVAL = 7000

/**
 * The home hero: three campaign photographs of the same cast, crossfading.
 * Every product in a photo carries a hotspot that links to it; the hotspots
 * live in a box that reproduces the image's object-cover crop (see
 * `.cover-box`), so they stay on the product at any viewport. On desktop the
 * photo is a full-bleed background behind the headline; on phones it sits on
 * top, and phones load a 4:5 crop on the group rather than the wide image.
 * Only the first campaign loads with the page; the others mount once it has
 * loaded, so they never compete with it. Pauses on hover and focus, and
 * never auto-advances with reduced motion.
 */
export function HeroCarousel({ slides, children }: { slides: HeroSlide[]; children: React.ReactNode }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [spot, setSpot] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const mount = () => setTimeout(() => setReady(true), 1200)
    if (document.readyState === 'complete') {
      const t = mount()
      return () => clearTimeout(t)
    }
    let t: ReturnType<typeof setTimeout> | undefined
    const onLoad = () => (t = mount())
    window.addEventListener('load', onLoad, { once: true })
    return () => {
      window.removeEventListener('load', onLoad)
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (paused || reduced || slides.length < 2) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), INTERVAL)
    return () => clearTimeout(t)
  }, [index, paused, reduced, slides.length])

  const go = (i: number) => {
    setReady(true)
    setSpot(null)
    setIndex(i)
  }
  const current = slides[index]!

  return (
    <div
      className="relative flex flex-col lg:min-h-[min(62rem,100svh)]"
      aria-roledescription="carrusel"
      aria-label="Campañas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false)
        setSpot(null)
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] max-h-[74svh] w-full overflow-hidden bg-sand [container-type:size] sm:aspect-[5/4] lg:absolute lg:inset-0 lg:aspect-auto lg:max-h-none">
        {slides.map((s, i) => {
          if (i > 0 && !ready) return null
          const on = i === index
          const style = {
            '--ar-phone': s.phone.width / s.phone.height,
            '--ar-wide': s.width / s.height,
            '--px-t': s.focus.tablet[0],
            '--py-t': s.focus.tablet[1],
            '--px-d': s.focus.desktop[0],
            '--py-d': s.focus.desktop[1],
          } as CSSProperties
          return (
            <div
              key={s.src}
              aria-hidden={!on}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${on ? 'z-[1] opacity-100' : 'opacity-0'}`}
            >
              <div
                style={style}
                className={`cover-box origin-[70%_45%] transition-transform duration-[8000ms] ease-out motion-reduce:transition-none ${on ? 'scale-100' : 'scale-[1.05]'}`}
              >
                <SlideImage slide={s} first={i === 0} />
                {s.products.map((p, j) => (
                  <Hotspot key={p.href} product={p} crop={s.phone.crop} tabbable={on} open={on && spot === j} onHover={(v) => setSpot(v ? j : null)} />
                ))}
              </div>
            </div>
          )
        })}
        {/* Phones: the photo fades into the paper under it. Desktop: a wash behind the headline, and one under the header. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/4 bg-linear-to-t from-paper to-paper/0 lg:hidden" />
        <div className="pointer-events-none absolute inset-0 z-[2] hidden bg-linear-to-r from-paper/90 from-0% via-paper/55 via-35% to-paper/0 to-58% lg:block" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] hidden h-40 bg-linear-to-b from-paper/55 to-paper/0 lg:block" />
      </div>

      <div className="container-page relative z-[3] -mt-14 pb-24 lg:pointer-events-none lg:mt-0 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:pt-32 lg:pb-44 lg:*:pointer-events-auto">
        <div className="max-w-xl">
          {children}

          <div className="mt-9 lg:mt-11">
            <p className="flex items-center gap-2 text-[0.75rem] font-medium tracking-[0.08em] text-ink-muted uppercase">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              En la foto · {current.title}
            </p>
            <ul key={current.src} className="animate-fade scroller -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {current.products.map((p, j) => (
                <li key={p.href} className="shrink-0">
                  <Link
                    href={p.href}
                    onMouseEnter={() => setSpot(j)}
                    onMouseLeave={() => setSpot(null)}
                    onFocus={() => setSpot(j)}
                    onBlur={() => setSpot(null)}
                    className={`group flex items-center gap-2.5 rounded-full py-1 pr-3.5 pl-1 ring-1 transition-colors ${
                      spot === j ? 'bg-paper ring-ink/25' : 'bg-paper/85 ring-ink/8 hover:bg-paper'
                    }`}
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-full" style={{ backgroundColor: p.color }}>
                      <Image src={p.thumb} alt="" fill sizes="36px" className="scale-[1.55] object-cover object-[50%_42%]" />
                    </span>
                    <span className="max-w-[11rem] truncate text-[0.8125rem] font-medium">{p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Campaign tabs, with the time left on the current one; they sit under the text, clear of the products. */}
        <div
          className="mt-9 grid max-w-md grid-cols-3 gap-4"
          role="group"
          aria-label="Elegir campaña"
        >
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => go(i)}
              aria-label={`Campaña ${i + 1} de ${slides.length}: ${s.title}`}
              aria-current={i === index}
              className="group text-left"
            >
              <span className="relative block h-0.5 overflow-hidden rounded-full bg-ink/15">
                <span
                  key={i === index ? `on-${index}` : 'off'}
                  className={`absolute inset-y-0 left-0 origin-left rounded-full bg-ink ${
                    i === index ? (reduced ? 'w-full' : 'animate-progress w-full') : i < index ? 'w-full opacity-35' : 'w-0'
                  }`}
                  style={i === index && !reduced ? { animationDuration: `${INTERVAL}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined}
                />
              </span>
              <span className={`mt-2.5 flex items-baseline gap-2 text-[0.8125rem] transition-colors ${i === index ? 'text-ink' : 'text-ink-muted group-hover:text-ink'}`}>
                <span className="tabular text-[0.6875rem]">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate font-medium">{s.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const CARD = {
  left: 'top-1/2 right-full mr-3 -translate-y-1/2',
  right: 'top-1/2 left-full ml-3 -translate-y-1/2',
  above: 'bottom-full left-1/2 mb-3 -translate-x-1/2',
  below: 'top-full left-1/2 mt-3 -translate-x-1/2',
}

/** One campaign photograph: the phone crop below 640px, the wide image above, one download either way. */
function SlideImage({ slide: s, first }: { slide: HeroSlide; first: boolean }) {
  const common = { alt: s.alt, fill: true, sizes: '100vw', quality: 75 } as const
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: s.src })
  const { props: { srcSet: phone, ...rest } } = getImageProps({
    ...common,
    src: s.phone.src,
    loading: first ? 'eager' : 'lazy',
    fetchPriority: first ? 'high' : 'low',
  })
  return (
    <picture>
      <source media="(min-width: 40rem)" srcSet={wide} sizes="100vw" />
      <img {...rest} srcSet={phone} className="object-cover" />
    </picture>
  )
}

/** A dot beside a product in the photo; on desktop, hovering or focusing it previews the product. */
function Hotspot({
  product: p,
  crop,
  tabbable,
  open,
  onHover,
}: {
  product: HeroProduct
  crop: HeroSlide['phone']['crop']
  tabbable: boolean
  open: boolean
  onHover: (v: boolean) => void
}) {
  const [x, y] = p.spot
  // The same spot in the phone crop.
  const style = { '--x': x, '--y': y, '--x-phone': (x - crop.left) / crop.width, '--y-phone': y } as CSSProperties
  return (
    <Link
      href={p.href}
      tabIndex={tabbable ? undefined : -1}
      aria-label={`${p.brand}, ${p.name}, ${p.price}. Ver producto`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="spot group/spot absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={style}
    >
      <span className="relative grid size-6 place-items-center rounded-full bg-paper/90 shadow-[0_6px_18px_-6px_rgb(40_30_20/0.55)] ring-1 ring-ink/10 backdrop-blur-sm transition-transform group-hover/spot:scale-110 lg:size-8">
        <span className="animate-halo absolute inset-0 rounded-full ring-2 ring-paper motion-reduce:hidden" aria-hidden="true" />
        <span className="size-2 rounded-full bg-accent lg:size-2.5" aria-hidden="true" />
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute hidden w-64 items-center gap-3 rounded-2xl bg-paper p-2 pr-4 shadow-[0_24px_48px_-20px_rgb(40_30_20/0.5)] ring-1 ring-ink/5 transition-opacity duration-300 lg:flex ${CARD[p.card]} ${open ? 'opacity-100' : 'opacity-0 group-hover/spot:opacity-100 group-focus-visible/spot:opacity-100'}`}
      >
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: p.color }}>
          <Image src={p.thumb} alt="" fill sizes="56px" className="scale-[1.35] object-cover object-[50%_45%]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] tracking-[0.06em] text-ink-muted uppercase">{p.brand}</span>
          <span className="block text-[0.875rem] leading-snug font-medium">{p.name}</span>
          <span className="tabular mt-0.5 block text-[0.8125rem] text-ink-soft">{p.price}</span>
        </span>
        <ArrowUpRight size={16} className="shrink-0 text-ink-muted" />
      </span>
    </Link>
  )
}
