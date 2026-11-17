import { BrandMark } from '@/components/icons'

export function Wordmark({ className = '', inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={30} inverse={inverse} />
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-display text-[1.45rem] leading-none tracking-[-0.02em]">
          La<span className="italic">Rutina</span>
        </span>
        <span className={`text-[0.6875rem] font-medium tracking-[0.08em] ${inverse ? 'text-paper/60' : 'text-ink-muted'}`}>beauty</span>
      </span>
    </span>
  )
}
