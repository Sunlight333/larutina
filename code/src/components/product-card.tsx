import Image from 'next/image'
import Link from 'next/link'
import { QuickAddButton } from './add-to-cart-button'
import { Star, StepIcon } from './icons'
import { STEP, type StepType } from '@/lib/diagnosis/copy'
import { productImage } from '@/lib/images'
import { formatARS } from '@/lib/money'
import type { CatalogProduct } from '@/server/services/catalog'

/**
 * Product card: the packshot in an arch, the routine step it belongs to, and a
 * quick-add button. Product displays keep the plain packshot on purpose.
 */
export function ProductCard({ product, sizes, note }: { product: CatalogProduct; sizes: string; note?: string }) {
  const img = productImage(product.slug)
  const step = STEP[product.routineStepType as StepType]
  return (
    <article className="group relative">
      <Link href={`/producto/${product.slug}`} className="block rounded-t-full">
        <div className="shape-arch relative aspect-[4/5] overflow-hidden" style={{ backgroundColor: img?.color }}>
          {img && (
            <Image
              src={img.src}
              alt={product.name}
              fill
              sizes={sizes}
              placeholder="blur"
              blurDataURL={img.blur}
              className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
            />
          )}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-paper/85 px-2.5 py-1 text-[0.75rem] font-medium backdrop-blur">
            <StepIcon type={product.routineStepType} size={15} />
            {step?.name}
          </span>
        </div>
        <div className="mt-4 px-0.5">
          <p className="text-[0.8125rem] text-ink-muted">{product.brand.name}</p>
          <h3 className="mt-0.5 font-display text-[1.2rem] leading-snug text-balance group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
            {product.name}
          </h3>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="tabular text-[0.9375rem]">{formatARS(product.priceCents)}</span>
            <span className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-muted">
              <Star size={13} />
              <span className="tabular">{product.avgRating.toLocaleString('es-AR')}</span>
            </span>
          </div>
          {note && <p className="mt-2 text-[0.8125rem] leading-snug text-ink-muted">{note}</p>}
        </div>
      </Link>
      {/* Same aspect as the image, so the button sits on the photo's corner. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
        <QuickAddButton name={product.name} className="pointer-events-auto absolute right-3 bottom-3" />
      </div>
    </article>
  )
}
