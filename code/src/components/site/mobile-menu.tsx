'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Close, Menu } from '@/components/icons'
import { navIcon } from '@/components/site/nav-icons'
import { LanguagePills } from '@/components/site/language-switcher'
import type { LinkItem } from '@/server/settings/registry'

// Mobile menu (G-06): large links on cards with their icons, "Diagnóstico" as the button, and the
// WhatsApp line at the foot. Closes on navigation and with Esc.
export function MobileMenu({ items, whatsapp, mark }: { items: LinkItem[]; whatsapp: string | null; mark: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const id = useId()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const regular = items.filter((i) => !i.highlight)
  const highlighted = items.filter((i) => i.highlight)

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full text-ink hover:bg-shell"
      >
        {open ? <Close size={26} /> : <Menu size={26} />}
      </button>
      {open &&
        // Rendered on the body: the header's backdrop blur would otherwise
        // confine this fixed panel to the header bar.
        createPortal(
        <div id={id} role="dialog" aria-modal="true" aria-label="Menú" className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-paper px-6 pb-10">
          <div className="-mx-2 flex h-20 items-center justify-between">
            <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full hover:bg-shell">
              <Close size={22} />
            </button>
            <Link href="/" aria-label="Inicio">{mark}</Link>
            <span className="size-11" aria-hidden="true" />
          </div>
          <div className="mx-auto mb-8 h-px w-16 bg-accent" aria-hidden="true" />
          <nav aria-label="Menú principal">
            <ul className="space-y-2.5">
              {regular.map((item, i) => {
                const I = navIcon(item.href)
                return (
                  <li key={item.href} className="animate-rise" style={{ animationDelay: `${60 + i * 60}ms` }}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-4 rounded-[1.25rem_2.5rem_1.25rem_2.5rem] bg-shell px-4 py-3.5 font-display text-[1.6rem] leading-tight text-ink shadow-[var(--shadow-soft)] ring-1 ring-line/60 active:scale-[0.99]"
                    >
                      <span className="grid size-12 place-items-center rounded-full bg-paper text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_6px_14px_-8px_rgb(40_30_20/0.4)]">
                        <I size={26} />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <ArrowRight size={22} className="text-ink-muted" />
                    </Link>
                  </li>
                )
              })}
            </ul>
            {highlighted.map((item) => {
              const I = navIcon(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="animate-rise mt-7 flex h-15 items-center justify-center gap-2.5 rounded-full bg-ink text-[0.9375rem] font-bold uppercase tracking-[0.12em] text-paper shadow-[var(--shadow-lift)]"
                  style={{ animationDelay: `${60 + regular.length * 60}ms` }}
                >
                  <I size={24} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <LanguagePills label={false} className="animate-rise mt-8 [&_ul]:justify-center" />
          {whatsapp && (
            <a href={whatsapp} className="mt-8 block text-center text-sm text-ink-soft underline underline-offset-4">
              ¿Dudas? Escribinos por WhatsApp
            </a>
          )}
        </div>,
          document.body,
        )}
    </>
  )
}
