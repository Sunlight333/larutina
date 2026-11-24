'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from '@/components/icons'
import { FlagAR, FlagBR, FlagUS } from '@/components/site/flags'

// The language switcher: Spanish, Brazilian Portuguese and English, each with
// its flag. The store is in Spanish (GEN-10: Spanish, pesos and Argentina in
// the MVP); the other two languages are listed as coming soon until their
// translations exist, and cannot be picked yet.

type Locale = { code: string; short: string; name: string; region: string; Flag: typeof FlagAR; ready: boolean }

export const LOCALES: Locale[] = [
  { code: 'es-AR', short: 'ES', name: 'Español', region: 'Argentina', Flag: FlagAR, ready: true },
  { code: 'pt-BR', short: 'PT', name: 'Português', region: 'Brasil', Flag: FlagBR, ready: false },
  { code: 'en', short: 'EN', name: 'English', region: 'United States', Flag: FlagUS, ready: false },
]
const CURRENT = LOCALES[0]!

/** A small "soon" tag for the languages not translated yet. */
function Soon({ tone = 'light' }: { tone?: 'light' | 'pill' }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${tone === 'pill' ? 'bg-paper/70 text-ink-muted' : 'bg-shell text-ink-muted ring-1 ring-line'}`}>
      Pronto
    </span>
  )
}

/** The header's switcher: the current flag on a round button, opening a floating card with the three languages. */
export function LanguageMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')[active]?.focus()
  }, [open, active])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    const last = LOCALES.length - 1
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a === last ? 0 : a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a === 0 ? last : a - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(last)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={`Idioma: ${CURRENT.name}`}
        onClick={() => {
          setActive(0)
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setActive(e.key === 'ArrowUp' ? LOCALES.length - 1 : 0)
            setOpen(true)
          }
        }}
        className="group/lang flex h-10 items-center gap-1 rounded-full pl-1.5 pr-1 transition-colors hover:bg-shell aria-expanded:bg-shell"
      >
        <span className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/lang:-translate-y-px group-hover/lang:rotate-[-8deg]">
          <CURRENT.Flag size={24} />
        </span>
        <ChevronDown size={14} className="text-ink-muted transition-transform duration-300 group-aria-expanded/lang:rotate-180" />
      </button>

      {open && (
        <div className="animate-pop absolute right-[-0.75rem] top-[calc(100%+0.85rem)] z-50 w-[17.5rem] origin-top-right">
          {/* The card's notch, pointing at the flag. */}
          <span aria-hidden="true" className="absolute -top-1.5 right-6 size-3.5 rotate-45 rounded-[3px] bg-paper ring-1 ring-line/80 [clip-path:polygon(0_0,100%_0,0_100%)]" />
          <ul
            ref={menu}
            id={`${id}-menu`}
            role="menu"
            aria-label="Idioma"
            onKeyDown={onKey}
            className="rounded-[1.25rem_2rem_1.25rem_1.25rem] bg-paper p-2 shadow-[var(--shadow-float)] ring-1 ring-line/80"
          >
            <li role="presentation" className="px-3 pb-1.5 pt-2 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Idioma
            </li>
            {LOCALES.map((l, i) => {
              const current = l.code === CURRENT.code
              return (
                <li key={l.code} role="presentation">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={current}
                    aria-disabled={!l.ready || undefined}
                    tabIndex={i === active ? 0 : -1}
                    lang={l.code}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      if (l.ready) close()
                    }}
                    className={`flex w-full items-center gap-3 rounded-[1rem] px-3 py-2.5 text-left outline-none transition-colors ${i === active ? 'bg-shell' : ''} ${l.ready ? '' : 'cursor-default'}`}
                  >
                    <span className={l.ready ? '' : 'opacity-80 saturate-[0.85]'}>
                      <l.Flag size={30} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[0.9875rem] font-bold leading-tight ${l.ready ? 'text-ink' : 'text-ink-soft'}`}>{l.name}</span>
                      <span className="block text-[0.8125rem] text-ink-muted">{l.region}</span>
                    </span>
                    {current ? (
                      <span className="grid size-6 place-items-center rounded-full bg-ink text-paper">
                        <Check size={14} />
                      </span>
                    ) : (
                      !l.ready && <Soon />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The switcher as a row of flag pills, for the mobile menu and the footer. */
export function LanguagePills({ className = '', label = true }: { className?: string; label?: boolean }) {
  return (
    <div className={className}>
      {label && <p className="mb-3 text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-ink">Idioma</p>}
      <ul className="flex flex-wrap gap-2" aria-label="Idioma">
        {LOCALES.map((l) => {
          const current = l.code === CURRENT.code
          return (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                aria-pressed={current}
                aria-disabled={!l.ready || undefined}
                aria-label={l.ready ? l.name : `${l.name}, próximamente`}
                className={`flex h-11 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[0.875rem] font-bold transition-[background-color,box-shadow,translate] duration-200 ${
                  current
                    ? 'bg-paper text-ink shadow-[var(--shadow-soft)] ring-1 ring-line'
                    : 'cursor-default bg-ink/[0.04] text-ink-soft ring-1 ring-ink/10'
                }`}
              >
                <l.Flag size={30} />
                {l.short === 'PT' ? 'PT-BR' : l.short}
                {current && <Check size={15} className="text-accent-ink" />}
                {!l.ready && <Soon tone="pill" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
