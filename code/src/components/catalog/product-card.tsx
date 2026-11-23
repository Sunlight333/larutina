import Link from 'next/link'
import type { ProductCardData } from '@/server/services/catalog/cards'
import { StepIcon } from '@/components/icons'
import { ProductImage } from './product-image'
import { Price } from './price'
import { QuickAdd } from './quick-add'

export const CARD_SIZES = '(min-width: 1216px) 270px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw'

// NAV-04, S-16 to S-19, in the approved design's card: the packshot in an
// arch with its routine step on it and the round quick-add button on its
// corner; below, brand, name in the display face, price with the promo
// struck through and the size. Labels sit on the photo; pre-sale and stock
// states under the price.
export function ProductCard({ product, eager = false, headingLevel = 'h3', sizes = CARD_SIZES, note }: { product: ProductCardData; eager?: boolean; headingLevel?: 'h2' | 'h3'; sizes?: string; note?: string }) {
  const href = `/producto/${product.code}`
  const Heading = headingLevel
  const main = product.variants[0]
  const count = product.variants.length
  return (
    <article className="group relative">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block rounded-t-full">
        <ProductImage
          image={product.image}
          alt=""
          step={product.routineStep}
          label={product.brand.name}
          eager={eager}
          sizes={sizes}
          shape="arch"
          imageClassName="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
        />
      </Link>
      {/* Same aspect as the image, so the badges and the button sit on the photo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
        {product.labels.length > 0 && (
          <span className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center gap-1.5" aria-hidden="true">
            {product.labels.map((l) => (
              <span key={l} className="whitespace-nowrap rounded-full bg-paper/90 px-2.5 py-1 text-[0.6875rem] font-medium tracking-wide text-ink backdrop-blur">
                {l}
              </span>
            ))}
          </span>
        )}
        <span className="absolute bottom-3 left-3 inline-flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 rounded-full bg-paper/85 px-2.5 py-1 text-[0.75rem] font-medium backdrop-blur" aria-hidden="true">
          <StepIcon type={product.routineStep} size={15} className="shrink-0" />
          <span className="truncate">{product.stepLabel}</span>
        </span>
        <div className="pointer-events-auto absolute bottom-3 right-3">
          <QuickAdd
            variant="round"
            product={{
              name: product.name,
              brand: product.brand.name,
              routineStep: product.routineStep,
              image: product.image ? { src: product.image.src, width: product.image.width, height: product.image.height } : null,
              variants: product.variants,
            }}
          />
        </div>
      </div>
      <div className="mt-4 px-0.5">
        <p className="text-[0.8125rem] text-ink-muted">{product.brand.name}</p>
        <Heading className="mt-0.5 font-display text-[1.2rem] leading-snug text-balance">
          <Link href={href} className="group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
            {product.name}
          </Link>
          {/* Labels are drawn on the photo, which is hidden from screen readers. */}
          {product.labels.length > 0 && <span className="sr-only"> ({product.labels.join(', ')})</span>}
        </Heading>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Price priceCents={product.priceCents} chargedCents={product.chargedCents} />
          {main && (
            <span className="text-[0.8125rem] text-ink-muted">
              {main.sizeLabel}
              {count > 1 && ` · ${count} tamaños`}
            </span>
          )}
        </div>
        {product.presale && <p className="mt-1.5 text-[0.8125rem] font-medium text-sage-ink">{product.presale}</p>}
        {product.stock === 'out' && <p className="mt-1.5 text-[0.8125rem] font-medium text-ink-muted">Sin stock por ahora</p>}
        {note && <p className="mt-2 text-[0.8125rem] leading-snug text-ink-muted">{note}</p>}
      </div>
    </article>
  )
}
