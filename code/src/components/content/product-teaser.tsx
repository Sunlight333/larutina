import Image from 'next/image'
import Link from 'next/link'
import { formatARS } from '@/lib/money'
import type { ProductTeaser } from '@/server/services/content/catalog'

// A compact product card for content blocks and articles. The catalog's own
// card lives with the listing; this one only needs name, brand, image and
// price, and links to the product page.

const STATUS_LABEL: Partial<Record<ProductTeaser['status'], string>> = { PRESALE: 'Preventa', SOLD_OUT: 'Agotado' }

export function ProductTeaserCard({ product, sizes = '(min-width: 1024px) 18rem, 45vw' }: { product: ProductTeaser; sizes?: string }) {
  const label = STATUS_LABEL[product.status]
  return (
    <Link href={product.href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-shell">
        {product.image ? (
          <Image src={product.image.src} alt={product.image.alt ?? ''} fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span className="absolute inset-0 grid place-items-center px-4 text-center font-display text-lg text-ink-muted">{product.brand}</span>
        )}
        {label && <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-medium">{label}</span>}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.08em] text-ink-muted">{product.brand}</p>
      <p className="mt-1 font-medium leading-snug group-hover:underline group-hover:underline-offset-4">{product.name}</p>
      {product.priceCents != null && (
        <p className="mt-1.5 text-sm tabular">
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

/** A small round link to a product, for callouts next to a photo. */
export function ProductChip({ product }: { product: ProductTeaser }) {
  return (
    <Link href={product.href} className="flex items-center gap-3 rounded-full border border-line bg-paper py-1.5 pl-1.5 pr-4 text-sm hover:border-ink">
      <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-shell">
        {product.image && <Image src={product.image.src} alt="" fill sizes="40px" className="object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block text-xs text-ink-muted">{product.brand}</span>
      </span>
    </Link>
  )
}

export function ProductGrid({ products }: { products: ProductTeaser[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.code}>
          <ProductTeaserCard product={p} />
        </li>
      ))}
    </ul>
  )
}
