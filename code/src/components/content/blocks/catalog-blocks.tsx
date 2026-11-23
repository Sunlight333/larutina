import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from '@/components/icons'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import type { BlockDataMap } from '@/server/services/content/blocks'
import { getBrandLogos, getConcernCards, getProductTeasers, getRoutineTeasers } from '@/server/services/content/catalog'
import { ProductGrid } from '../product-teaser'
import { SectionHeader, TextLink } from './shared'

// Blocks filled from the catalog. Each hides itself when there is nothing
// published to show, so the Home never shows an empty section.

export async function NeedsBlock({ data }: { data: BlockDataMap['needs'] }) {
  const codes = data.concernCodes.length ? data.concernCodes : (await getSettings())['listing.concernOrder']
  const cards = await getConcernCards(getDb(), codes)
  if (!cards.length) return null
  return (
    <section className="container-page py-12 md:py-16" aria-labelledby="bloque-necesidades">
      <SectionHeader id="bloque-necesidades" eyebrow={data.eyebrow} title={data.title} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.code}>
            <Link href={c.href} className="group flex h-full items-start justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5 transition-colors hover:border-ink">
              <span>
                <span className="block font-display text-[1.375rem] leading-tight">{c.shortLabel || c.name}</span>
                {c.shortDescription && <span className="mt-2 block text-[0.9375rem] leading-snug text-ink-muted">{c.shortDescription}</span>}
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                <ArrowUpRight size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function RoutinesBlock({ data }: { data: BlockDataMap['routines'] }) {
  const routines = await getRoutineTeasers(getDb(), data.routineCodes.length ? data.routineCodes : null)
  if (!routines.length) return null
  return (
    <section className="container-page py-12 md:py-16">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {routines.map((r) => (
          <li key={r.code}>
            <Link href={r.href} className="flex h-full flex-col rounded-[var(--radius-card)] bg-shell p-6 transition-colors hover:bg-sand">
              <span className="font-display text-[1.375rem] leading-tight">{r.name}</span>
              <span className="mt-2 flex-1 text-[0.9375rem] leading-snug text-ink-soft">{r.goal}</span>
              <span className="mt-5 text-sm text-ink-muted">{r.steps === 1 ? '1 paso' : `${r.steps} pasos`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function FeaturedBlock({ data }: { data: BlockDataMap['featured'] }) {
  const codes = data.productCodes.length ? data.productCodes : (await getSettings())['listing.featured']
  const products = await getProductTeasers(getDb(), codes)
  if (!products.length) return null
  return (
    <section className="container-page py-12 md:py-16">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <div className="mt-10">
        <ProductGrid products={products} />
      </div>
    </section>
  )
}

export async function BrandsBlock({ data }: { data: BlockDataMap['brands'] }) {
  const brands = await getBrandLogos(getDb())
  if (!brands.length) return null
  return (
    <section className="container-page py-12 md:py-16">
      <SectionHeader eyebrow={data.eyebrow} title={data.title} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6">
        {brands.map((b) => (
          <li key={b.code}>
            <Link href={b.href} className="block text-ink-soft hover:text-ink">
              {b.logo ? (
                <Image src={b.logo.src} alt={b.name} width={Math.round((b.logo.width / b.logo.height) * 40)} height={40} className="h-10 w-auto object-contain" />
              ) : (
                <span className="font-display text-2xl">{b.name}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
