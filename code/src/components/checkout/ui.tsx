// Pieces shared by the cart, the checkout and the order page: the form field
// look, the notices box and the totals (BO-09). No state, so both server and
// client components use them.
import type { ReactNode } from 'react'
import { Alert } from '@/components/icons'
import { formatARS } from '@/lib/money'
import { STEP_LABELS } from '@/server/services/catalog/labels'

export const fieldClass =
  'h-13 w-full rounded-2xl border border-line-strong bg-paper px-5 text-base outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_var(--color-shell)] aria-[invalid=true]:border-[oklch(0.55_0.17_25)]'

export const errorText = 'text-sm font-medium text-[oklch(0.5_0.17_25)]'

/** The leaf-cornered panel of the summaries. */
export const leafPanel = 'rounded-[1.25rem_2.5rem_1.25rem_2.5rem]'

export const productos = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`

/** BO-08 and CK-06 when there is no rate for that postcode. */
export const NO_RATES = 'Por ahora no podemos cotizar envíos a ese código postal.'

/** "[Correo] · llega en [x] a [y] días hábiles" (BO-08, CK-06). */
export function deliveryLine(o: { carrier: string; minDays: number; maxDays: number }) {
  const days = o.minDays === o.maxDays ? `${o.maxDays}` : `${o.minDays} a ${o.maxDays}`
  return `${o.carrier} · llega en ${days} ${o.maxDays === 1 ? 'día hábil' : 'días hábiles'}`
}

/** The routine step code for a step label, for the photo placeholder's colour. */
export function stepOf(label: string): string {
  return Object.entries(STEP_LABELS).find(([, l]) => l === label)?.[0] ?? 'OTHER'
}

/** BO-11, CK-16..18: what changed or went wrong, said where it happened. */
export function Notices({ items, tone = 'warn' }: { items: string[]; tone?: 'warn' | 'error' }) {
  if (!items.length) return null
  return (
    <div role="alert" className={`flex gap-3 rounded-[1.25rem_2rem_1.25rem_2rem] px-5 py-4 text-[0.9375rem] leading-relaxed ${tone === 'error' ? 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.42_0.14_25)]' : 'bg-accent-soft text-ink'}`}>
      <Alert size={22} className="mt-0.5 shrink-0 text-accent-ink" />
      <div className="space-y-1">
        {items.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>
    </div>
  )
}

export type TotalsInput = {
  subtotalCents: number
  discountCents: number
  /** null: "Se calcula en el siguiente paso". */
  shippingCents: number | null
  shippingFree?: boolean
  totalCents: number
  /** BO-09: "Con transferencia: $[x]", only when transfer is offered with a discount. */
  transferTotalCents?: number | null
}

export function Totals({ t, children }: { t: TotalsInput; children?: ReactNode }) {
  return (
    <dl className="space-y-2.5 text-[0.9375rem]">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="font-medium tabular">{formatARS(t.subtotalCents)}</dd>
      </div>
      {t.discountCents > 0 && (
        <div className="flex justify-between gap-4 text-sage-ink">
          <dt>Descuentos</dt>
          <dd className="font-medium tabular">−{formatARS(t.discountCents)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt>Envío</dt>
        <dd className={`text-right tabular ${t.shippingCents === null ? 'text-ink-muted' : 'font-medium'}`}>
          {t.shippingCents === null ? 'Se calcula en el siguiente paso' : t.shippingFree || t.shippingCents === 0 ? 'Gratis' : formatARS(t.shippingCents)}
        </dd>
      </div>
      {children}
      <div className="flex items-baseline justify-between gap-4 border-t border-line-strong pt-3.5">
        <dt className="text-lg font-semibold">Total</dt>
        <dd className="font-display text-[1.75rem] leading-none tabular">{formatARS(t.totalCents)}</dd>
      </div>
      {t.transferTotalCents != null && (
        <div className="flex justify-between gap-4 text-sm text-ink-soft">
          <dt>Con transferencia:</dt>
          <dd className="font-semibold tabular text-ink">{formatARS(t.transferTotalCents)}</dd>
        </div>
      )}
    </dl>
  )
}
