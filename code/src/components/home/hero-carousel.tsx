'use client'

import { getImageProps } from 'next/image'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

export type HeroSlide = {
  src: string
  width: number
  height: number
  /** The 4:5 image phones load instead, and where it sits in the wide image (fractions of its width). */
  phone: { src: string; width: number; height: number; crop: { left: number; width: number } }
  alt: string
  title: string
  /** object-position of the wide image as fractions: tablets frame the group, desktop keeps the left half for the headline. */
  focus: { tablet: [number, number]; desktop: [number, number] }
}

const INTERVAL = 7000

/**
 * The Home hero of the approved design: campaign photographs crossfading
 * behind a fixed headline. On desktop the photo is a full-bleed background
 * behind the text; on phones it sits on top and fades into the page, and
 * phones load a 4:5 image rather than the wide one. Only the first photo
 * loads with the page; the others mount once it has loaded. Pauses on hover
 * and focus, and never auto-advances with reduced motion. With one photo
 * (the one uploaded in the panel) there are no tabs.
 */
export function HeroCarousel({ slides, children }: { slides: HeroSlide[]; children: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
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
    setIndex(i)
  }

  return (
    <div
      className="relative flex flex-col lg:min-h-[min(62rem,100svh)]"
      {...(slides.length > 1 ? { 'aria-roledescription': 'carrusel', 'aria-label': 'Campañas' } : {})}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
            <div key={s.src} aria-hidden={!on} className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${on ? 'z-[1] opacity-100' : 'opacity-0'}`}>
              <div style={style} className={`cover-box origin-[70%_45%] transition-transform duration-[8000ms] ease-out motion-reduce:transition-none ${on ? 'scale-100' : 'scale-[1.05]'}`}>
                <SlideImage slide={s} first={i === 0} />
              </div>
            </div>
          )
        })}
        {/* Phones: the photo fades into the paper under it. Desktop: a light veil under the header. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/4 bg-linear-to-t from-paper to-paper/0 lg:hidden" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] hidden h-40 bg-linear-to-b from-paper/55 to-paper/0 lg:block" />
      </div>

      <div className="container-page relative z-[3] -mt-14 pb-24 lg:pointer-events-none lg:mt-0 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:pt-40 lg:pb-44 lg:*:pointer-events-auto">
        {/* Desktop: the text on a frosted, leaf-cornered panel layered over the photo. */}
        <div className="max-w-[37.5rem] lg:relative lg:rounded-[1.25rem_6rem_1.25rem_6rem] lg:bg-paper/72 lg:p-11 lg:pb-10 lg:shadow-[var(--shadow-float)] lg:ring-1 lg:ring-white/70 lg:backdrop-blur-xl xl:p-12 xl:pb-11">
          {children}

          {/* Campaign tabs, with the time left on the current one. */}
          {slides.length > 1 && (
            <div className="mt-10 grid grid-cols-3 gap-5 lg:mt-9 lg:border-t lg:border-line lg:pt-7" role="group" aria-label="Elegir campaña">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Campaña ${i + 1} de ${slides.length}: ${s.title}`}
                  aria-current={i === index}
                  className="group text-left"
                >
                  <span className="relative block h-[3px] overflow-hidden rounded-full bg-ink/12">
                  <span
                    key={i === index ? `on-${index}` : 'off'}
                    className={`absolute inset-y-0 left-0 origin-left rounded-full bg-ink ${
                      i === index ? (reduced ? 'w-full' : 'animate-progress w-full') : i < index ? 'w-full opacity-35' : 'w-0'
                    }`}
                    style={i === index && !reduced ? { animationDuration: `${INTERVAL}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined}
                  />
                </span>
                  <span className={`mt-3 flex items-baseline gap-2 transition-colors ${i === index ? 'text-ink' : 'text-ink-muted group-hover:text-ink'}`}>
                    <span className={`tabular text-[0.8125rem] font-bold ${i === index ? 'text-accent-ink' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="truncate text-[0.9375rem] font-semibold">{s.title}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** One photograph: the phone image below 640px, the wide image above, one download either way. */
function SlideImage({ slide: s, first }: { slide: HeroSlide; first: boolean }) {
  const common = { alt: s.alt, fill: true, sizes: '100vw', quality: 75 } as const
  const {
    props: { srcSet: wide },
  } = getImageProps({ ...common, src: s.src })
  const {
    props: { srcSet: phone, ...rest },
  } = getImageProps({
    ...common,
    src: s.phone.src,
    loading: first ? 'eager' : 'lazy',
    fetchPriority: first ? 'high' : 'low',
  })
  return (
    <picture>
      <source media="(min-width: 40rem)" srcSet={wide} sizes="100vw" />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from the props */}
      <img {...rest} srcSet={phone} className="object-cover" />
    </picture>
  )
}
