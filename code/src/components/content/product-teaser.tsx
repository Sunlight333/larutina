import Image from 'next/image'
import Link from 'next/link'
import { formatARS } from '@/lib/money'
import { StepIcon } from '@/components/icons'
import { ProductImage, stepTint } from '@/components/catalog/product-image'
import type { ProductTeaser } from '@/server/services/content/catalog'

// The product card for content blocks and articles, in the approved
// design's look (the packshot in an arch): name, brand, image and price, and
// a link to the product page. The catalog's own card, with quick add, lives
// with the listing.

const STATUS_LABEL: Partial<Record<ProductTeaser['status'], string>> = { PRESALE: 'Preventa', SOLD_OUT: 'Agotado' }

export function ProductTeaserCard({ product, sizes = '(min-width: 1024px) 18rem, 45vw' }: { product: ProductTeaser; sizes?: string }) {
  const label = STATUS_LABEL[product.status]
  return (
    <Link href={product.href} className="group block">
      <div className="relative">
        <ProductImage
          image={product.image}
          alt={product.image?.alt ?? ''}
          step={product.routineStep}
          label={product.brand}
          sizes={sizes}
          shape="arch"
          imageClassName="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
        />
        {label && <span className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-paper/90 px-2.5 py-1 text-[0.6875rem] font-medium">{label}</span>}
      </div>
      <p className="mt-4 text-[0.8125rem] text-ink-muted">{product.brand}</p>
      <p className="mt-0.5 font-display text-[1.2rem] leading-snug text-balance group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{product.name}</p>
      {product.priceCents != null && (
        <p className="mt-2 text-[0.9375rem] tabular">
          {product.compareAtCents != null && (
            <span className="mr-2 text-ink-muted line-through">
              <span className="sr-only">Antes </span>
              {formatARS(product.compareAtCents)}
            </span>
          )}
          {formatARS(product.priceCents)}
        </p>
      )}
    </Link>
  )
}

/** A round thumbnail of a product: its photo, or its step on the step's backdrop. */
export function ProductDot({ product, className = 'size-12', sizes = '48px' }: { product: ProductTeaser; className?: string; sizes?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full text-ink/70 ${className}`} style={{ backgroundColor: stepTint(product.routineStep) }}>
      {product.image ? <Image src={product.image.src} alt="" fill sizes={sizes} className="object-cover" /> : <StepIcon type={product.routineStep} size={18} />}
    </span>
  )
}

/** A small round link to a product, for callouts next to a photo. */
export function ProductChip({ product }: { product: ProductTeaser }) {
  return (
    <Link href={product.href} className="flex items-center gap-3 rounded-full bg-paper py-1.5 pl-1.5 pr-4 text-sm ring-1 ring-line hover:ring-ink/40">
      <ProductDot product={product} className="size-10" sizes="40px" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block text-xs text-ink-muted">{product.brand}</span>
      </span>
    </Link>
  )
}

export function ProductGrid({ products }: { products: ProductTeaser[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.code}>
          <ProductTeaserCard product={p} />
        </li>
      ))}
    </ul>
  )
}
