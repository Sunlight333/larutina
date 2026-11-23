import { formatARS } from '@/lib/money'

/** The charged price, with the regular price struck through when there is a promo (NAV-04). */
export function Price({ priceCents, chargedCents, className = '', size = 'md' }: { priceCents: number; chargedCents: number; className?: string; size?: 'md' | 'lg' }) {
  const promo = chargedCents < priceCents
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 tabular ${className}`}>
      <span className={`${size === 'lg' ? 'text-2xl' : 'text-[0.9375rem]'} font-medium ${promo ? 'text-accent-ink' : 'text-ink'}`}>
        {promo && <span className="sr-only">Precio promocional: </span>}
        {formatARS(chargedCents)}
      </span>
      {promo && (
        <s className={`${size === 'lg' ? 'text-base' : 'text-sm'} text-ink-muted`}>
          <span className="sr-only">Precio anterior: </span>
          {formatARS(priceCents)}
        </s>
      )}
    </p>
  )
}
