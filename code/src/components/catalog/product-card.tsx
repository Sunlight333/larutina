import Link from 'next/link'
import type { ProductCardData } from '@/server/services/catalog/cards'
import { ProductImage } from './product-image'
import { Price } from './price'
import { QuickAdd } from './quick-add'

// NAV-04, S-16 to S-19: 4:5 photo, routine step, brand, name, price with the
// promo struck through, labels, pre-sale and stock states, and quick add.
export function ProductCard({ product, eager = false, headingLevel = 'h3' }: { product: ProductCardData; eager?: boolean; headingLevel?: 'h2' | 'h3' }) {
  const href = `/producto/${product.code}`
  const Heading = headingLevel
  const main = product.variants[0]
  const sizes = product.variants.length
  return (
    <article className="group flex h-full flex-col">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block overflow-hidden rounded-[var(--radius-image)]">
        <ProductImage
          image={product.image}
          alt=""
          step={product.routineStep}
          label={product.brand.name}
          eager={eager}
          sizes="(min-width: 80rem) 18rem, (min-width: 64rem) 22vw, (min-width: 40rem) 30vw, 46vw"
          className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.02]"
        />
        {(product.labels.length > 0 || product.presale) && (
          <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {product.labels.map((l) => (
              <span key={l} className="rounded-full bg-paper/95 px-2.5 py-1 text-[0.6875rem] font-medium tracking-wide text-ink shadow-sm">
                {l}
              </span>
            ))}
          </span>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-xs text-ink-muted">
          {product.stepLabel} · <span className="uppercase tracking-wide">{product.brand.name}</span>
        </p>
        <Heading className="mt-1 text-[0.9375rem] leading-snug">
          <Link href={href} className="hover:underline hover:underline-offset-2">
            {product.name}
          </Link>
          {/* Labels are drawn on the photo, which is hidden from screen readers. */}
          {product.labels.length > 0 && <span className="sr-only"> ({product.labels.join(', ')})</span>}
        </Heading>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <Price priceCents={product.priceCents} chargedCents={product.chargedCents} />
          {main && (
            <span className="text-xs text-ink-muted">
              {main.sizeLabel}
              {sizes > 1 && ` · ${sizes} tamaños`}
            </span>
          )}
        </div>
        {product.presale && <p className="mt-1.5 text-xs font-medium text-sage-ink">{product.presale}</p>}
        {product.stock === 'out' && <p className="mt-1.5 text-xs font-medium text-ink-muted">Sin stock por ahora</p>}
        <div className="mt-auto pt-3">
          <QuickAdd
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
    </article>
  )
}
