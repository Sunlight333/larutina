'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bag, ChevronDown, Close, ConcernIcon, FaceScan, Menu, Search } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { useToast } from '@/components/toast'
import { Wordmark } from './wordmark'

export type NavConcern = {
  slug: string
  name: string
  description: string
  image: { src: string; blur: string }
}

const LINKS = [
  { href: '/productos', label: 'Productos' },
  { href: '/diagnostico', label: 'Diagnóstico' },
  { href: '/sobre-esta-demo', label: 'Sobre la demo' },
]

const BAG_MESSAGE = 'La demo no tiene carrito. En la tienda real, acá ves los productos que agregaste.'

/**
 * Sticky header. Over the home hero it starts transparent and turns into a
 * frosted bar on scroll; elsewhere it is solid. "Necesidades" opens a mega
 * menu on desktop; phones get a full-height drawer.
 */
export function SiteHeader({ concerns, diagnosisImage }: { concerns: NavConcern[]; diagnosisImage: { src: string; blur: string } }) {
  const pathname = usePathname()
  const overHero = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [mega, setMega] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const megaTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const megaButton = useRef<HTMLButtonElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const { show } = useToast()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Any navigation closes the menus.
  useEffect(() => {
    setMega(false)
    setDrawer(false)
  }, [pathname])

  const closeDrawer = useCallback(() => {
    setDrawer(false)
    menuButton.current?.focus()
  }, [])

  // Escape closes whatever is open; the drawer also locks page scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (drawer) closeDrawer()
      if (mega) {
        setMega(false)
        megaButton.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, mega, closeDrawer])

  useEffect(() => {
    if (!drawer) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    closeButton.current?.focus()
    return () => {
      root.style.overflow = previous
    }
  }, [drawer])

  const openMega = () => {
    clearTimeout(megaTimer.current)
    setMega(true)
  }
  const closeMegaSoon = () => {
    clearTimeout(megaTimer.current)
    megaTimer.current = setTimeout(() => setMega(false), 140)
  }

  const solid = !overHero || scrolled || mega
  const iconButton = `${iconButtonBase} ${solid ? '' : 'lg:bg-paper/70 lg:ring-1 lg:ring-ink/5 lg:backdrop-blur-md'}`
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        solid
          ? 'border-b border-line/70 bg-paper/88 shadow-[0_10px_30px_-24px_rgb(40_30_20/0.45)] backdrop-blur-xl'
          : 'border-b border-line/70 bg-paper/88 backdrop-blur-xl lg:border-transparent lg:bg-transparent lg:backdrop-blur-none'
      }`}
    >
      <div className="container-page grid h-16 grid-cols-[1fr_auto] items-center gap-4 lg:h-[4.5rem] lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="-ml-1 justify-self-start rounded-full px-1">
          <Wordmark />
          <span className="sr-only"> · inicio</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          <Link href="/productos" className={navLink(active('/productos'))} aria-current={active('/productos') ? 'page' : undefined}>
            Productos
          </Link>
          <div onMouseEnter={openMega} onMouseLeave={closeMegaSoon}>
            <button
              ref={megaButton}
              type="button"
              className={`${navLink(mega)} gap-1`}
              aria-expanded={mega}
              aria-controls="menu-necesidades"
              onClick={() => (mega ? setMega(false) : openMega())}
            >
              Necesidades
              <ChevronDown size={16} className={`transition-transform duration-300 ${mega ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {LINKS.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className={navLink(active(l.href))} aria-current={active(l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-1 sm:gap-1.5">
          <Link href="/productos" aria-label="Buscar productos" className={iconButton}>
            <Search size={21} />
          </Link>
          <button type="button" aria-label="Carrito" className={`${iconButton} relative`} onClick={() => show(BAG_MESSAGE)}>
            <Bag size={21} />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-paper" aria-hidden="true" />
          </button>
          {!pathname.startsWith('/diagnostico') && (
            <Link
              href="/diagnostico"
              className="ml-2 hidden h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft lg:inline-flex"
            >
              Hacer mi diagnóstico
            </Link>
          )}
          <button
            ref={menuButton}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={drawer}
            aria-controls="menu-movil"
            className={`${iconButton} lg:hidden`}
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mega menu. `hidden` keeps its images from loading until it opens. */}
      <div
        id="menu-necesidades"
        hidden={!mega}
        onMouseEnter={openMega}
        onMouseLeave={closeMegaSoon}
        className="absolute inset-x-0 top-full hidden border-b border-line/70 bg-paper/96 shadow-[0_40px_60px_-40px_rgb(40_30_20/0.4)] backdrop-blur-xl lg:block"
      >
        <div className="container-page animate-fade grid grid-cols-[1fr_20rem] gap-12 py-9">
          <div>
            <p className="eyebrow">Comprar por necesidad</p>
            <ul className="mt-5 grid grid-cols-3 gap-x-6 gap-y-4">
              {concerns.map((c) => (
                <li key={c.slug}>
                  <Link href={`/productos?necesidad=${c.slug}`} className="group -m-2 flex items-center gap-4 rounded-2xl p-2 transition-colors hover:bg-shell">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-full ring-1 ring-line">
                      <Image src={c.image.src} alt="" fill sizes="64px" placeholder="blur" blurDataURL={c.image.blur} className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-display text-[1.15rem] leading-tight">
                        <ConcernIcon slug={c.slug} size={17} className="shrink-0 text-accent-ink" />
                        {c.name}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[0.8125rem] leading-snug text-ink-muted">{c.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/diagnostico" className="shape-arch group relative flex min-h-[19rem] flex-col justify-end overflow-hidden p-6 text-paper">
            <Image src={diagnosisImage.src} alt="" fill sizes="320px" placeholder="blur" blurDataURL={diagnosisImage.blur} className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/25 to-transparent" />
            <span className="relative">
              <FaceScan size={26} />
              <span className="mt-3 block font-display text-[1.45rem] leading-tight">¿No sabés por dónde empezar?</span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
                Hacé el diagnóstico <ArrowRight size={16} />
              </span>
            </span>
          </Link>
        </div>
      </div>

      {drawer && (
        <div id="menu-movil" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" tabIndex={-1} className="animate-fade absolute inset-0 bg-ink/35" onClick={closeDrawer} />
          <div className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-paper">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <Wordmark />
              <button ref={closeButton} type="button" aria-label="Cerrar menú" className={iconButton} onClick={closeDrawer}>
                <Close size={22} />
              </button>
            </div>
            <nav aria-label="Menú" className="px-4 pt-4">
              <ul>
                {LINKS.map((l) => (
                  <li key={l.href} className="border-b border-line">
                    <Link href={l.href} className="flex items-center justify-between py-4 font-display text-[1.9rem] leading-none">
                      {l.label}
                      <ArrowUpRight size={22} className="text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="eyebrow mt-8">Comprar por necesidad</p>
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {concerns.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/productos?necesidad=${c.slug}`} className="flex items-center gap-3 rounded-full bg-shell p-1.5 pr-3">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-full">
                        <Image src={c.image.src} alt="" fill sizes="40px" placeholder="blur" blurDataURL={c.image.blur} className="object-cover" />
                      </span>
                      <span className="text-sm leading-tight font-medium">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto space-y-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link href="/diagnostico" className={buttonClasses('primary', 'lg', 'w-full')}>
                <FaceScan size={20} />
                Hacer mi diagnóstico
              </Link>
              <p className="text-center text-xs text-ink-muted">Demo técnica · productos y marcas de ejemplo</p>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

const iconButtonBase = 'grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/6'

function navLink(on: boolean) {
  return `relative inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] transition-colors hover:bg-ink/5 ${
    on ? 'font-medium text-ink after:absolute after:inset-x-4 after:bottom-1.5 after:h-px after:bg-ink' : 'text-ink-soft'
  }`
}
