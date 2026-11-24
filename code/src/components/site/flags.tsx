// Round flag icons for the language switcher, drawn for small sizes: the
// flag's main shapes only, so each reads at 20 px. Each sits in a circle with
// a fine inner ring and a soft lift, like the site's icon badges.

type FlagProps = { size?: number; className?: string }

function Round({ size = 24, className = '', children }: FlagProps & { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-full shadow-[0_3px_8px_-3px_rgb(40_30_20/0.45)] after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_1px_rgb(40_30_20/0.14),inset_0_1.5px_0_rgb(255_255_255/0.45)] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" className="block size-full">
        {children}
      </svg>
    </span>
  )
}

/** Argentina: Spanish as the store writes it. Sky blue, white, sky blue, and the Sun of May. */
export function FlagAR(props: FlagProps) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <Round {...props}>
      <rect width="32" height="32" fill="#fff" />
      <rect width="32" height="10.7" fill="#74ACDF" />
      <rect y="21.3" width="32" height="10.7" fill="#74ACDF" />
      <g transform="translate(16 16)" fill="#F6B40E">
        {rays.map((a) => (
          <path key={a} d="M-0.7 -2.6 L0 -4.6 L0.7 -2.6 Z" transform={`rotate(${a})`} />
        ))}
        <circle r="2.3" stroke="#85340A" strokeWidth="0.35" />
      </g>
    </Round>
  )
}

/** Brazil: Brazilian Portuguese. Green field, gold rhombus, blue globe with its white band. */
export function FlagBR(props: FlagProps) {
  return (
    <Round {...props}>
      <rect width="32" height="32" fill="#009C3B" />
      <path d="M16 4.5 L30 16 L16 27.5 L2 16 Z" fill="#FFDF00" />
      <circle cx="16" cy="16" r="6.4" fill="#002776" />
      <path d="M9.8 14.6 C 13.5 13.4, 18.8 13.9, 22.3 16.6 L 22.1 17.9 C 18.8 15.3, 13.7 14.8, 9.7 16 Z" fill="#fff" />
    </Round>
  )
}

/** United States: English. Red and white stripes, the blue canton with its stars. */
export function FlagUS(props: FlagProps) {
  const stripes = Array.from({ length: 7 }, (_, i) => i)
  const stars = [
    [3, 3], [7, 3], [11, 3],
    [5, 6], [9, 6], [13, 6],
    [3, 9], [7, 9], [11, 9],
    [5, 12], [9, 12], [13, 12],
    [3, 15], [7, 15], [11, 15],
  ]
  return (
    <Round {...props}>
      <rect width="32" height="32" fill="#fff" />
      {stripes.map((i) => (
        <rect key={i} y={i * 4.92} width="32" height="2.46" fill="#B22234" />
      ))}
      <rect width="15.5" height="17.2" fill="#3C3B6E" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.75" fill="#fff" />
      ))}
    </Round>
  )
}
