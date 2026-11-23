import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

// The panel's building blocks. Every admin screen is made of these, so the
// panel stays consistent and each new screen is mostly data (Phase 1 step 2:
// one generic list and form layer that later admin screens reuse).

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="text-sm text-ink-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ title, description, children, className = '', actions }: { title?: string; description?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-paper p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <div className="mt-0.5 text-sm text-ink-muted">{description}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
const tones: Record<Tone, string> = {
  neutral: 'bg-shell text-ink-soft',
  success: 'bg-sage-soft text-sage-ink',
  warning: 'bg-accent-soft text-accent-ink',
  danger: 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.15_25)]',
  info: 'bg-night-soft text-night',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-muted">{children}</p>
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const btn: Record<BtnVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'border border-line-strong bg-paper text-ink hover:border-ink',
  danger: 'bg-[oklch(0.5_0.17_25)] text-paper hover:bg-[oklch(0.45_0.17_25)]',
  ghost: 'text-ink-soft hover:bg-shell hover:text-ink',
}

export function adminButton(variant: BtnVariant = 'primary', extra = '') {
  return `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${btn[variant]} ${extra}`
}

export function AdminLink({ variant = 'secondary', className = '', ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={adminButton(variant, className)} {...props} />
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-xl border border-line bg-paper p-4 hover:border-ink">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-line bg-paper p-4">{body}</div>
  )
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export const formatDateTime = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(d)) : '—'

export const formatDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(d)) : '—'
