import Image from 'next/image'

// Product photos are 4:5 (CAT-17), set on a warm backdrop as in the approved
// design's packshots. Until a product's photos are uploaded its frame shows
// an intentional placeholder: the backdrop colour of its routine step and a
// quiet silhouette of the container it comes in (dropper, bottle, jar, tube
// or pump), so a grid without photos still reads as a set of packshots.

type Shape = 'dropper' | 'bottle' | 'jar' | 'tube' | 'pump'

const LOOK: Record<string, { bg: string; cap: string; shape: Shape }> = {
  MAKEUP_REMOVER: { bg: '#E1D0BC', cap: '#8C7A6B', shape: 'pump' },
  CLEANSER: { bg: '#C9D6CC', cap: '#5F7266', shape: 'pump' },
  EXFOLIANT: { bg: '#F2DAC4', cap: '#A0745A', shape: 'bottle' },
  TONER: { bg: '#C2C7B3', cap: '#66705A', shape: 'bottle' },
  ESSENCE: { bg: '#DACDDD', cap: '#7D6B82', shape: 'bottle' },
  SERUM: { bg: '#EFD3B0', cap: '#9A6A43', shape: 'dropper' },
  EYE_CONTOUR: { bg: '#EACDC6', cap: '#9B6A61', shape: 'tube' },
  MOISTURIZER: { bg: '#D1BEA9', cap: '#7E6650', shape: 'jar' },
  OIL: { bg: '#F1DCB4', cap: '#9C7A45', shape: 'dropper' },
  SUNSCREEN: { bg: '#EECCB8', cap: '#A26E55', shape: 'tube' },
  MASK: { bg: '#D6B4A8', cap: '#8A6456', shape: 'jar' },
  TREATMENT: { bg: '#BDABB3', cap: '#6E5A64', shape: 'dropper' },
}
const FALLBACK = { bg: '#CBC3BC', cap: '#6F655D', shape: 'bottle' as Shape }

/** The backdrop colour of a step, for frames around small thumbnails too. */
export function stepTint(step: string): string {
  return (LOOK[step] ?? FALLBACK).bg
}

function Silhouette({ shape, cap }: { shape: Shape; cap: string }) {
  const body = 'rgb(255 253 249 / 0.88)'
  const label = 'rgb(255 255 255 / 0.65)'
  return (
    <svg viewBox="0 0 100 125" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
      <ellipse cx="50" cy="52" rx="46" ry="44" fill="#fff" opacity="0.16" />
      <ellipse cx="50" cy="52" rx="30" ry="30" fill="#fff" opacity="0.12" />
      <ellipse cx="50" cy="99" rx={shape === 'jar' ? 26 : 19} ry="2.6" fill="#000" opacity="0.1" />
      {shape === 'dropper' && (
        <g>
          <rect x="45.5" y="27" width="9" height="15" rx="4.5" fill={cap} />
          <rect x="42.5" y="40" width="15" height="10" rx="2" fill={cap} />
          <rect x="36" y="49" width="28" height="49" rx="7" fill={body} />
          <rect x="40" y="64" width="20" height="17" rx="1.5" fill={label} />
        </g>
      )}
      {shape === 'bottle' && (
        <g>
          <rect x="42" y="25" width="16" height="15" rx="3" fill={cap} />
          <rect x="45" y="38" width="10" height="5" fill={body} />
          <rect x="34" y="42" width="32" height="56" rx="9" fill={body} />
          <rect x="38" y="60" width="24" height="20" rx="1.5" fill={label} />
        </g>
      )}
      {shape === 'jar' && (
        <g>
          <rect x="26" y="62" width="48" height="12" rx="3" fill={cap} />
          <rect x="28" y="72" width="44" height="26" rx="6" fill={body} />
          <rect x="35" y="79" width="30" height="11" rx="1.5" fill={label} />
        </g>
      )}
      {shape === 'tube' && (
        <g>
          <path d="M37 27h26l-3.5 55h-19z" fill={body} />
          <rect x="36" y="25" width="28" height="4" rx="1" fill={body} />
          <rect x="41.5" y="81" width="17" height="17" rx="3" fill={cap} />
          <rect x="42" y="44" width="16" height="20" rx="1.5" fill={label} />
        </g>
      )}
      {shape === 'pump' && (
        <g>
          <rect x="44" y="24" width="18" height="5" rx="2" fill={cap} />
          <rect x="47" y="28" width="6" height="9" fill={cap} />
          <rect x="43" y="36" width="14" height="8" rx="2" fill={cap} />
          <rect x="35" y="43" width="30" height="55" rx="8" fill={body} />
          <rect x="39" y="60" width="22" height="20" rx="1.5" fill={label} />
        </g>
      )}
    </svg>
  )
}

/** The frame without a photo: the step's backdrop and its container's silhouette. */
export function ProductPlaceholder({ step, label }: { step: string; label?: string }) {
  const look = LOOK[step] ?? FALLBACK
  return (
    <div className="absolute inset-0" style={{ backgroundColor: look.bg }} role="img" aria-label={label ? `${label}: foto próximamente` : 'Foto próximamente'}>
      <Silhouette shape={look.shape} cap={look.cap} />
    </div>
  )
}

export type ImageData = { src: string; width: number; height: number; alt?: string | null }

/**
 * A 4:5 frame with the photo, or the placeholder. `shape="arch"` is the
 * design's product card; `rounded` the product page and lists; `className`
 * sets the width and any other rounding.
 */
export function ProductImage({
  image,
  alt,
  step,
  label,
  sizes,
  eager = false,
  className = '',
  imageClassName = '',
  shape = 'none',
}: {
  image: ImageData | null | undefined
  alt: string
  step: string
  label?: string
  sizes: string
  /** The likely LCP image: loads first (next/image deprecated `priority` in 16). */
  eager?: boolean
  className?: string
  imageClassName?: string
  shape?: 'arch' | 'rounded' | 'none'
}) {
  const frame = shape === 'arch' ? 'shape-arch' : shape === 'rounded' ? 'rounded-[var(--radius-image)]' : ''
  return (
    <div className={`relative aspect-[4/5] overflow-hidden ${frame} ${className}`} style={{ backgroundColor: stepTint(step) }}>
      {image ? (
        <Image src={image.src} alt={alt} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} className={`object-cover ${imageClassName}`} />
      ) : (
        <div className={`absolute inset-0 ${imageClassName}`}>
          <ProductPlaceholder step={step} label={label} />
        </div>
      )}
    </div>
  )
}
