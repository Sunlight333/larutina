import type { ReactNode } from 'react'
import { IconBadge } from '@/components/icons'

// Pieces shared by the Mi Larutina screens.

export function AccountHeading({ icon, title, eyebrow, children }: { icon: ReactNode; title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="animate-rise mb-8 flex items-start gap-4 md:mb-10 md:items-center md:gap-5">
      <IconBadge size="lg" className="hidden sm:grid">
        {icon}
      </IconBadge>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-display-md text-balance">{title}</h1>
        {children && <div className="mt-2 text-lede text-ink-soft">{children}</div>}
      </div>
    </header>
  )
}

/** An empty section (CU-09, CU-11, CU-13, CU-15): the content file's sentence and its way forward. */
export function EmptyState({ icon, children, actions }: { icon: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="tex-linen relative overflow-hidden rounded-[1.5rem_3.5rem_1.5rem_3.5rem] bg-shell px-6 py-10 text-center shadow-[var(--shadow-soft)] ring-1 ring-line/70 sm:px-12 sm:py-14">
      <span aria-hidden="true" className="absolute -right-10 -top-10 size-40 rounded-full bg-accent-soft/70" />
      <div className="relative">
        <IconBadge size="xl" tone="paper" className="mx-auto">
          {icon}
        </IconBadge>
        <div className="mx-auto mt-6 max-w-lg font-display text-[1.4rem] leading-snug text-balance md:text-[1.6rem]">{children}</div>
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

const WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince']

/** "Son ocho preguntas" (CU-09) from the {preguntas} copy variable. */
export const countWord = (n: number) => WORDS[n] ?? String(n)

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
export const longDate = (d: Date) => dateFormat.format(d)
