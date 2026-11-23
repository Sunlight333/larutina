'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Close, Menu } from '@/components/icons'
import type { LinkItem } from '@/server/settings/registry'

// Mobile menu (G-06): large serif links, "Diagnóstico" as the button, and the
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
      {open && (
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
            <ul className="space-y-1">
              {regular.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block py-2.5 font-display text-[2rem] leading-tight text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {highlighted.map((item) => (
              <Link key={item.href} href={item.href} className="mt-8 flex h-13 items-center justify-center rounded-full bg-ink text-sm font-medium uppercase tracking-[0.16em] text-paper">
                {item.label}
              </Link>
            ))}
          </nav>
          {whatsapp && (
            <a href={whatsapp} className="mt-8 block text-center text-sm text-ink-soft underline underline-offset-4">
              ¿Dudas? Escribinos por WhatsApp
            </a>
          )}
        </div>
      )}
    </>
  )
}
