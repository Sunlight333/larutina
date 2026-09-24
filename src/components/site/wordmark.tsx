export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="font-display text-[1.5rem] leading-none tracking-[-0.02em]">
        La<span className="italic">Rutina</span>
      </span>
      <span className="text-[0.6875rem] font-medium tracking-[0.08em] text-ink-muted">beauty</span>
    </span>
  )
}
