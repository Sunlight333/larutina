// The demo's icon set: one 24px grid, 1.6 stroke, round caps. Drawn inline,
// no icon library (plan §8). Step and concern icons have their own lookups.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

// ─── Interface ───────────────────────────────────────────────────────────────

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const ArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17L17 7M8.5 7H17v8.5" />
  </Icon>
)

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Icon>
)

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const Search = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icon>
)

export const Bag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8.5h13l-1 11.2a1.5 1.5 0 01-1.5 1.3H8a1.5 1.5 0 01-1.5-1.3z" />
    <path d="M9 8.5V7a3 3 0 016 0v1.5" />
  </Icon>
)

export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5h16M4 15.5h16" />
  </Icon>
)

export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const Sun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
  </Icon>
)

export const Moon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
  </Icon>
)

export const Alert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l9 16H3l9-16z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </Icon>
)

export const Info = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.1" />
  </Icon>
)

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1" />
  </Icon>
)

export const Refresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
    <path d="M4 3.5V8h4.5" />
    <path d="M4 13a8 8 0 0014.3 4.9L20 16" />
    <path d="M20 20.5V16h-4.5" />
  </Icon>
)

export const Droplet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2c3.2 3.8 6 7.2 6 10.3a6 6 0 01-12 0c0-3.1 2.8-6.5 6-10.3z" />
  </Icon>
)

// ─── Value and feature icons ─────────────────────────────────────────────────

export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const FaceScan = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
    <path d="M9 10v.6M15 10v.6M9.5 14.8a3.6 3.6 0 005 0" />
  </Icon>
)

export const ShieldCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.1z" />
    <path d="M9 12l2.2 2.2L15.3 10" />
  </Icon>
)

export const Flask = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v5.3l-4.8 8.7a2 2 0 001.8 3h9a2 2 0 001.8-3l-4.8-8.7V3.5" />
    <path d="M7.8 14.5h8.4" />
  </Icon>
)

export const Layers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l8.5 4.5L12 13 3.5 8.5z" />
    <path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />
  </Icon>
)

export const Award = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M9.2 13.8L8 20.5l4-2.2 4 2.2-1.2-6.7" />
  </Icon>
)

export const Bulb = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 17.5h5M10.5 20.5h3" />
    <path d="M12 3.5a5.8 5.8 0 00-3.4 10.5c.6.5.9 1.1.9 1.9v.1h5v-.1c0-.8.3-1.4.9-1.9A5.8 5.8 0 0012 3.5z" />
  </Icon>
)

export const Hand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 12.5V6.8a1.4 1.4 0 012.8 0V11" />
    <path d="M10.8 10.2V5.4a1.4 1.4 0 012.8 0V11" />
    <path d="M13.6 10.4V6.6a1.4 1.4 0 012.8 0v6.9c0 4-2.4 7-6.2 7-2.4 0-3.8-1.1-5-3.1l-1.6-2.8a1.4 1.4 0 012.3-1.6L8 14.5" />
  </Icon>
)

export const Chat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11.5a7.5 7.5 0 01-10.9 6.7L4.5 19.5l1.3-4A7.5 7.5 0 1120 11.5z" />
  </Icon>
)

export const Sparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
    <path d="M18.5 16l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" />
  </Icon>
)

export const Leaf = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19c0-8.2 5.2-13.2 14-14 0 8.8-5 14-13.2 14z" />
    <path d="M5 19l8.5-8.5" />
  </Icon>
)

// ─── Routine steps ───────────────────────────────────────────────────────────

export const Cleanser = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="9.5" width="10" height="11.5" rx="2.6" />
    <path d="M9.8 9.5V7.2h4.4v2.3M12 7.2V4.2M9.5 4.2H16v1.3" />
    <path d="M9.8 14.5h4.4" />
  </Icon>
)

export const Toner = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7.5" y="9" width="9" height="12" rx="2.4" />
    <rect x="9.5" y="3" width="5" height="4" rx="1" />
    <path d="M10.7 7v2M13.3 7v2M10 13.5h4M10 16h4" />
  </Icon>
)

export const Serum = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.2 7.2V4.7a1.8 1.8 0 013.6 0v2.5" />
    <rect x="9" y="7.2" width="6" height="2.3" rx=".6" />
    <rect x="8" y="9.5" width="8" height="11.5" rx="2.6" />
    <path d="M10.5 15h3" />
  </Icon>
)

export const Treatment = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5c2.6 3.1 5 6 5 8.8a5 5 0 01-10 0C6 11 8.4 8.1 11 5z" />
    <path d="M18.5 3v3.4M16.8 4.7h3.4" />
  </Icon>
)

export const Exfoliant = Sparkle

export const Moisturizer = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="6" width="14" height="3.6" rx="1.3" />
    <path d="M6.2 9.6h11.6V18a2.6 2.6 0 01-2.6 2.6H8.8A2.6 2.6 0 016.2 18z" />
    <path d="M9.5 14.5h5" />
  </Icon>
)

export const Sunscreen = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 3.5h9M8 3.5l1.2 11.5h5.6L16 3.5" />
    <rect x="9.3" y="15" width="5.4" height="5.5" rx="1.2" />
    <path d="M10.5 8.2h3" />
  </Icon>
)

const STEP_ICONS = {
  CLEANSER: Cleanser,
  TONER: Toner,
  EXFOLIANT: Exfoliant,
  SERUM: Serum,
  TREATMENT: Treatment,
  MOISTURIZER: Moisturizer,
  SUNSCREEN: Sunscreen,
} as const

export function StepIcon({ type, ...p }: IconProps & { type: string }) {
  const I = STEP_ICONS[type as keyof typeof STEP_ICONS] ?? Droplet
  return <I {...p} />
}

// ─── Concerns ────────────────────────────────────────────────────────────────

const Blemish = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="9.2" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="9.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12.6" cy="14.8" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
)

const Tone = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 000 17z" fill="currentColor" fillOpacity=".22" stroke="none" />
    <path d="M12 3.5v17" />
  </Icon>
)

const Hydration = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2c3.2 3.8 6 7.2 6 10.3a6 6 0 01-12 0c0-3.1 2.8-6.5 6-10.3z" />
    <path d="M9.3 14a2.8 2.8 0 002.4 2.6" />
  </Icon>
)

const Lines = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8c2.7-2 5.3-2 8 0s5.3 2 8 0M4 12c2.7-2 5.3-2 8 0s5.3 2 8 0M4 16c2.7-2 5.3-2 8 0s5.3 2 8 0" />
  </Icon>
)

const Pores = (p: IconProps) => (
  <Icon {...p}>
    {[7, 12, 17].flatMap((y) => [7, 12, 17].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" />))}
  </Icon>
)

const CONCERN_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  acne: Blemish,
  manchas: Tone,
  deshidratacion: Hydration,
  sensibilidad: Leaf,
  lineas: Lines,
  poros: Pores,
}

export function ConcernIcon({ slug, ...p }: IconProps & { slug: string }) {
  const I = CONCERN_ICONS[slug] ?? Droplet
  return <I {...p} />
}

// ─── Brand mark ──────────────────────────────────────────────────────────────

/** Sun over the horizon: the routine that starts every morning. */
export function BrandMark({ size = 28, className = '', inverse = false }: { size?: number; className?: string; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <circle cx="16" cy="16" r="16" fill={inverse ? 'var(--color-paper)' : 'var(--color-ink)'} />
      <path d="M8.5 20.5a7.5 7.5 0 0115 0z" fill="var(--color-accent)" />
      <path d="M6.5 22.8h19" stroke={inverse ? 'var(--color-ink)' : 'var(--color-paper)'} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Star({ filled = 1, size = 14 }: { filled?: number; size?: number }) {
  // filled: 0..1, rendered with a clip so half stars look right.
  const id = `s${Math.round(filled * 100)}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * filled} height="24" />
        </clipPath>
      </defs>
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="var(--color-line-strong)" />
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="var(--color-ink)" clipPath={`url(#${id})`} />
    </svg>
  )
}

/** An icon set in a round tinted badge: how icons are shown prominently. */
export function IconBadge({
  children,
  size = 'md',
  tone = 'accent',
  className = '',
}: {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'accent' | 'ink' | 'paper' | 'night' | 'sage'
  className?: string
}) {
  const sizes = { sm: 'size-9', md: 'size-12', lg: 'size-14', xl: 'size-[4.5rem]' }
  const tones = {
    accent: 'bg-accent-soft text-accent-ink',
    ink: 'bg-ink text-paper',
    paper: 'bg-paper text-ink shadow-[0_6px_20px_-10px_rgb(40_30_20/0.35)]',
    night: 'bg-white/10 text-paper ring-1 ring-white/15',
    sage: 'bg-sage-soft text-sage-ink',
  }
  return <span className={`grid shrink-0 place-items-center rounded-full ${sizes[size]} ${tones[tone]} ${className}`}>{children}</span>
}
