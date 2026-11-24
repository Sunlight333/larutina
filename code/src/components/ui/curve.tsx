/**
 * A soft arc between two sections. It is drawn in the colour of the section it
 * leads into (set with a text colour class), so the edge reads as one surface
 * bending into the next rather than a hard line, with the page's paper grain.
 * With `outside`, it paints the corners outside the arc instead: laid over the
 * top of a photograph in the page colour, the photograph itself gets the
 * curved edge. Textured bands cut their own arcs instead (the curved-band
 * utility), so their texture runs through the curve.
 */
export function Curve({ className = '', flip = false, outside = false }: { className?: string; flip?: boolean; outside?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`curve tex-grain pointer-events-none block h-10 w-full sm:h-14 lg:h-20 ${outside ? 'curve-outside' : ''} ${flip ? 'rotate-180' : ''} ${className}`}
    />
  )
}
