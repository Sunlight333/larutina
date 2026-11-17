import Image from 'next/image'
import { productImage } from '@/lib/images'

/**
 * A packshot in a 4:5 frame. The frame is painted with the photo's own
 * backdrop colour and a blurred preview, so nothing shifts or flashes while
 * the image loads.
 */
export function ProductImage({
  slug,
  name,
  sizes,
  lcp = false,
  className = '',
  rounded = 'rounded-[var(--radius-image)]',
}: {
  slug: string
  name: string
  sizes: string
  /** The page's LCP element: loads eagerly with high fetch priority. */
  lcp?: boolean
  className?: string
  rounded?: string
}) {
  const asset = productImage(slug)
  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden ${rounded} ${className}`}
      style={{ backgroundColor: asset?.color ?? 'var(--color-shell)' }}
    >
      {asset && (
        <Image
          src={asset.src}
          alt={name}
          fill
          sizes={sizes}
          loading={lcp ? 'eager' : 'lazy'}
          fetchPriority={lcp ? 'high' : undefined}
          placeholder="blur"
          blurDataURL={asset.blur}
          className="object-cover"
        />
      )}
    </div>
  )
}
