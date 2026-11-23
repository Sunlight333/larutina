import Image from 'next/image'
import mark from '@/assets/brand/mark.png'
import logo from '@/assets/brand/logo.png'

// The brand's emblem and full logo (docs/logo, "Sculpted"). The emblem is cut
// from the full logo with its relief shadow; next/image serves it as AVIF or
// WebP at the size the CSS gives it.

/** The emblem alone. `className` sets its size (it fills its box). */
export function LogoMark({ className = 'size-16', priority = false, alt = '', sizes = '128px' }: { className?: string; priority?: boolean; alt?: string; sizes?: string }) {
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <Image src={mark} alt={alt} fill sizes={sizes} priority={priority} className="object-contain" />
    </span>
  )
}

/** Emblem and wordmark, for light backgrounds. */
export function LogoFull({ className = 'w-72', priority = false, alt = 'LaRutina Beauty' }: { className?: string; priority?: boolean; alt?: string }) {
  return <Image src={logo} alt={alt} priority={priority} sizes="(min-width: 768px) 480px, 80vw" className={`h-auto ${className}`} />
}
