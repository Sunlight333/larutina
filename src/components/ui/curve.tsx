/**
 * A soft arc between two sections. It is drawn in the colour of the section it
 * leads into (set with a text colour class), so the edge reads as one surface
 * bending into the next rather than a hard line.
 */
export function Curve({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`pointer-events-none block h-10 w-full sm:h-14 lg:h-20 ${flip ? 'rotate-180' : ''} ${className}`}
    >
      <path d="M0 80V40C240 6 480 0 720 0s480 6 720 40v40z" fill="currentColor" />
    </svg>
  )
}
