'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@/components/icons'

export type HeroSlide = {
  src: string
  blur: string
  alt: string
  /** object-position classes: phones show the model, desktop keeps her clear of the headline. */
  position: string
  product: { href: string; name: string; brand: string; price: string; thumb: string; color: string }
}

const INTERVAL = 6500

/**
 * The home hero: three campaign images crossfading, with the product in the
 * current image linked under the call to action and the other campaigns as
 * thumbnails that double as controls. On desktop the images are a full-bleed
 * background behind the headline; on phones the image sits on top and the
 * headline follows on paper, so a face is never covered by text. Pauses on
 * hover and focus, and never auto-advances with reduced motion.
 */
export function HeroCarousel({ slides, children }: { slides: HeroSlide[]; children: React.ReactNode }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (paused || reduced || slides.length < 2) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), INTERVAL)
    return () => clearTimeout(t)
  }, [index, paused, reduced, slides.length])

  const current = slides[index]!

  return (
    <div
      className="relative flex flex-col lg:min-h-[min(60rem,96svh)]"
      aria-roledescription="carrusel"
      aria-label="Campañas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative h-[66svh] max-h-[36rem] min-h-[27rem] overflow-hidden lg:absolute lg:inset-0 lg:h-auto lg:max-h-none">
        {slides.map((s, i) => (
          <div
            key={s.src}
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              sizes="100vw"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'low'}
              placeholder="blur"
              blurDataURL={s.blur}
              className={`object-cover transition-transform duration-[7000ms] ease-out ${s.position} ${i === index ? 'scale-100' : 'scale-[1.04]'}`}
            />
          </div>
        ))}
        {/* Phones: the photo fades into the paper under it. Desktop: a wash behind the headline. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-paper to-paper/0 lg:hidden" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-paper/92 from-0% via-paper/50 via-38% to-paper/0 to-62% lg:block" />
      </div>

      <div className="container-page relative -mt-20 pb-24 lg:mt-0 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:pt-32 lg:pb-40">
        <div className="max-w-xl">
          {children}

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 lg:mt-12">
            <Link
              key={current.src}
              href={current.product.href}
              className="group animate-fade flex max-w-full items-center gap-3 rounded-full bg-paper/90 py-1.5 pr-4 pl-1.5 ring-1 ring-ink/8 transition-colors hover:bg-paper"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full" style={{ backgroundColor: current.product.color }}>
                <Image src={current.product.thumb} alt="" fill sizes="48px" className="scale-[1.55] object-cover object-[50%_42%]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.75rem] text-ink-muted">En la foto · {current.product.brand}</span>
                <span className="block truncate text-[0.9375rem] font-medium">{current.product.name}</span>
              </span>
              <span className="tabular hidden text-sm text-ink-soft sm:inline">{current.product.price}</span>
              <ArrowUpRight size={16} className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <div className="flex items-center gap-2" role="group" aria-label="Elegir campaña">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Campaña ${i + 1} de ${slides.length}: ${s.product.name}`}
                  aria-current={i === index}
                  className={`relative size-11 overflow-hidden rounded-full ring-offset-2 ring-offset-paper transition-[box-shadow,transform,opacity] duration-300 ${
                    i === index ? 'scale-105 ring-2 ring-ink' : 'opacity-70 ring-1 ring-ink/10 hover:opacity-100'
                  }`}
                >
                  <Image src={s.src} alt="" fill sizes="44px" className="object-cover object-[82%_25%]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
