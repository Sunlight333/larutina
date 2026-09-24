/**
 * A soft arc between two sections. It is drawn in the colour of the section it
 * leads into (set with a text colour class), so the edge reads as one surface
 * bending into the next rather than a hard line. With `outside`, it paints the
 * corners outside the arc instead: laid over the top of a photograph in the
 * page colour, the photograph itself gets the curved edge.
 */
export function Curve({ className = '', flip = false, outside = false }: { className?: string; flip?: boolean; outside?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`pointer-events-none block h-10 w-full sm:h-14 lg:h-20 ${flip ? 'rotate-180' : ''} ${className}`}
    >
      <path d={outside ? 'M0 0h1440v40C1200 6 960 0 720 0S240 6 0 40z' : 'M0 80V40C240 6 480 0 720 0s480 6 720 40v40z'} fill="currentColor" />
    </svg>
  )
}
