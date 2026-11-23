import { LogoMark } from '@/components/site/logo'

// Emblem plus the brand name set in type, echoing the full logo (serif name,
// letter-spaced "Beauty"). For places where the full logo image does not fit
// or sits on a dark background: the footer, the panel. The name comes from the
// panel (brand.name, GEN-07).
export function Wordmark({ name = 'LaRutina', className = '', inverse = false, markClassName = 'size-10' }: { name?: string; className?: string; inverse?: boolean; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[1.6rem] tracking-[-0.01em] ${inverse ? 'text-paper' : 'text-ink'}`}>{name}</span>
        <span className={`mt-1 text-[0.62rem] font-medium uppercase tracking-[0.42em] ${inverse ? 'text-paper/60' : 'text-ink-muted'}`}>Beauty</span>
      </span>
    </span>
  )
}
