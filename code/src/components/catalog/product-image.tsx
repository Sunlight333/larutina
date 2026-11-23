import Image from 'next/image'
import { StepIcon } from '@/components/icons'

// Product photos are 4:5 (CAT-17). Until a product's photos are uploaded it
// shows a placeholder drawn on purpose: a tint per routine step with the
// step's icon, so a grid without photos still reads as designed.

const TINTS: Record<string, string> = {
  MAKEUP_REMOVER: 'bg-sand text-ink-soft',
  CLEANSER: 'bg-shell text-ink-soft',
  EXFOLIANT: 'bg-accent-soft text-accent-ink',
  TONER: 'bg-sage-soft text-sage-ink',
  ESSENCE: 'bg-night-soft text-night',
  SERUM: 'bg-accent-soft text-accent-ink',
  EYE_CONTOUR: 'bg-night-soft text-night',
  MOISTURIZER: 'bg-sand text-ink-soft',
  OIL: 'bg-sand text-ink-soft',
  SUNSCREEN: 'bg-accent-soft text-accent-ink',
  MASK: 'bg-sage-soft text-sage-ink',
  TREATMENT: 'bg-night-soft text-night',
}

export type ImageData = { src: string; width: number; height: number; alt?: string | null }

export function ProductPlaceholder({ step, label, size = 'md' }: { step: string; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const icon = size === 'sm' ? 22 : size === 'lg' ? 56 : 40
  const ring = size === 'sm' ? 'size-12' : size === 'lg' ? 'size-32' : 'size-20'
  return (
    <div className={`relative flex size-full flex-col items-center justify-center ${TINTS[step] ?? 'bg-shell text-ink-soft'}`} role="img" aria-label={label ? `${label}: foto próximamente` : 'Foto próximamente'}>
      <span className={`grid ${ring} place-items-center rounded-full bg-paper/60`}>
        <StepIcon type={step} size={icon} />
      </span>
      {size !== 'sm' && label && <span className="absolute inset-x-3 bottom-3 truncate text-center text-xs tracking-wide opacity-70">{label}</span>}
    </div>
  )
}

/** A 4:5 frame with the photo, or the placeholder. */
export function ProductImage({
  image,
  alt,
  step,
  label,
  sizes,
  eager = false,
  className = '',
  placeholderSize,
}: {
  image: ImageData | null | undefined
  alt: string
  step: string
  label?: string
  sizes: string
  /** The likely LCP image: loads first (next/image deprecated `priority` in 16). */
  eager?: boolean
  className?: string
  placeholderSize?: 'sm' | 'md' | 'lg'
}) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden ${className}`}>
      {image ? (
        <Image src={image.src} alt={alt} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} className="object-cover" />
      ) : (
        <ProductPlaceholder step={step} label={label} size={placeholderSize} />
      )}
    </div>
  )
}
