import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ConcernIcon, IconBadge, Moon, Sun } from '@/components/icons'
import { ProductCard } from '@/components/catalog/product-card'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import type { BlockDataMap } from '@/server/services/content/blocks'
import { getBrandLogos, getConcernCards, getRoutineTeasers } from '@/server/services/content/catalog'
import { getCatalog } from '@/server/services/catalog/catalog'
import { toCards } from '@/server/services/catalog/cards'
import { concernPortrait, lifestyleImage } from '@/lib/images'
import { SectionHeader, TextLink } from './shared'

// Blocks filled from the catalog, in the approved design's sections. Each
// hides itself when there is nothing published to show, so the Home never
// shows an empty section.

/** Shop by need: tall arches, staggered, one of the campaign's cast in each. */
export async function NeedsBlock({ data }: { data: BlockDataMap['needs'] }) {
  const codes = data.concernCodes.length ? data.concernCodes : (await getSettings())['listing.concernOrder']
  const cards = await getConcernCards(getDb(), codes)
  if (!cards.length) return null
  return (
    <section className="defer-render mt-24 md:mt-32" aria-labelledby="bloque-necesidades">
      <div className="container-page">
        <SectionHeader id="bloque-necesidades" eyebrow={data.eyebrow} title={data.title} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      </div>
      <ul className="scroller mt-10 flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:mx-auto lg:grid lg:max-w-[76rem] lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-8 lg:pb-16">
        {cards.map((c, i) => {
          const img = concernPortrait(c.code, i)
          return (
            <li key={c.code} data-reveal="up" style={{ '--i': i % 3 } as React.CSSProperties} className={`w-[72vw] max-w-[19rem] shrink-0 sm:w-[42vw] lg:w-auto lg:max-w-none ${i % 3 === 1 ? 'lg:translate-y-16' : ''}`}>
              <Link href={c.href} className="group block">
                <div className="shape-arch relative aspect-[3/4] overflow-hidden bg-sand transition-[box-shadow,translate] duration-500 ease-[var(--ease-out-soft)] group-hover:-translate-y-1.5 group-hover:shadow-[var(--shadow-float)]">
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="(min-width: 1216px) 360px, (min-width: 1024px) 30vw, (min-width: 640px) 42vw, 72vw"
                    placeholder="blur"
                    blurDataURL={img.blur}
                    className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                  />
                </div>
                <div className="relative -mt-8 flex items-end justify-between px-4">
                  <IconBadge size="xl" tone="paper" className="ring-[5px] ring-paper">
                    <ConcernIcon slug={c.code} size={28} />
                  </IconBadge>
                  <span className="grid size-11 place-items-center rounded-full border border-line-strong bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <h3 className="mt-4 px-1 font-display text-[1.5rem] leading-tight">{c.name}</h3>
                {c.shortDescription && <p className="mt-1.5 px-1 text-[0.9375rem] leading-snug text-ink-muted">{c.shortDescription}</p>}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The published routines, each on a leaf-cornered photograph of its moment. */
export async function RoutinesBlock({ data }: { data: BlockDataMap['routines'] }) {
  const routines = await getRoutineTeasers(getDb(), data.routineCodes.length ? data.routineCodes : null)
  if (!routines.length) return null
  return (
    <section className="defer-render container-page mt-20 md:mt-28" aria-label={data.title || 'Rutinas armadas'}>
      <SectionHeader eyebrow={data.eyebrow} title={data.title} text={data.text} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:gap-8">
        {routines.map((r, i) => {
          const night = r.moment === 'PM'
          const img = lifestyleImage(night ? 'noche' : i % 2 ? 'diagnostico' : 'manana')
          return (
            <li key={r.code} className={i % 2 ? 'md:mt-16' : ''}>
              <Link href={r.href} className={`group relative flex min-h-[26rem] flex-col justify-end overflow-hidden p-6 text-paper sm:p-8 ${i % 2 ? 'shape-leaf-alt' : 'shape-leaf'}`}>
                <Image src={img.src} alt="" fill sizes="(min-width: 768px) 560px, 100vw" placeholder="blur" blurDataURL={img.blur} className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]" />
                <span className={`absolute inset-0 bg-linear-to-t to-transparent ${night ? 'from-night-deep/95 via-night-deep/40 via-45%' : 'from-ink/85 via-ink/30 via-45%'}`} />
                <span className="relative">
                  <IconBadge size="lg" tone="night">
                    {night ? <Moon size={24} /> : r.moment === 'AM' ? <Sun size={26} /> : <Sun size={24} />}
                  </IconBadge>
                  <span className="mt-5 block font-display text-display-sm">{r.name}</span>
                  <span className="mt-2 block max-w-sm text-paper/80">{r.goal}</span>
                  <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink/35 py-1.5 pl-3.5 pr-3 text-sm ring-1 ring-paper/20">
                    {r.steps === 1 ? '1 paso' : `${r.steps} pasos`}
                    <ArrowUpRight size={16} />
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** "Los más elegidos": the selection, as the catalog's cards with quick add. */
export async function FeaturedBlock({ data }: { data: BlockDataMap['featured'] }) {
  const codes = data.productCodes.length ? data.productCodes : (await getSettings())['listing.featured']
  if (!codes.length) return null
  const byCode = new Map((await getCatalog()).map((p) => [p.code, p]))
  const items = codes.flatMap((c) => byCode.get(c) ?? [])
  if (!items.length) return null
  const cards = await toCards(items)
  return (
    <section className="defer-render mt-28 md:mt-36" aria-label={data.title || 'Productos destacados'}>
      <div className="container-page">
        <SectionHeader eyebrow={data.eyebrow} title={data.title} link={<TextLink label={data.ctaLabel} href={data.ctaHref} />} />
      </div>
      <ul className="scroller mt-10 flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:mx-auto lg:grid lg:max-w-[76rem] lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-8 lg:pb-8">
        {cards.map((p, i) => (
          <li key={p.code} data-reveal="up" style={{ '--i': i % 4 } as React.CSSProperties} className="w-[62vw] max-w-[17rem] shrink-0 sm:w-[40vw] lg:w-auto lg:max-w-none">
            <ProductCard product={p} sizes="(min-width: 1216px) 270px, (min-width: 1024px) 23vw, (min-width: 640px) 40vw, 62vw" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The brands with published products, as a band of names (or logos) between soft curves. */
export async function BrandsBlock({ data }: { data: BlockDataMap['brands'] }) {
  const brands = await getBrandLogos(getDb())
  if (!brands.length) return null
  return (
    <section className="mt-20 md:mt-28" aria-label={data.title || 'Marcas'}>
      <div className="curved-band tex-linen bg-shell">
        <div className="container-page py-12 text-center md:py-16">
          {(data.eyebrow || data.title) && (
            <div className="mx-auto max-w-2xl">
              {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
              {data.title && <h2 className={`font-display text-display-md text-balance ${data.eyebrow ? 'mt-3' : ''}`}>{data.title}</h2>}
            </div>
          )}
          <ul className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-4 md:gap-x-6 ${data.eyebrow || data.title ? 'mt-10' : ''}`}>
            {brands.map((b, i) => (
              <li key={b.code} className="flex items-center gap-4 md:gap-6">
                {i > 0 && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
                <Link href={b.href} className="block text-ink-soft transition-colors hover:text-ink">
                  {b.logo ? (
                    <Image src={b.logo.src} alt={b.name} width={Math.round((b.logo.width / b.logo.height) * 40)} height={40} className="h-10 w-auto object-contain" />
                  ) : (
                    <span className="font-display text-[1.75rem] leading-none md:text-[2.25rem]">{b.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {data.ctaLabel && data.ctaHref && (
            <div className="mt-10">
              <TextLink label={data.ctaLabel} href={data.ctaHref} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
