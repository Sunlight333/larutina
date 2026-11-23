import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ConcernIcon, IconBadge } from '@/components/icons'
import { concernPortrait } from '@/lib/images'
import { PageIntro } from '@/components/catalog/page-intro'
import { DiagnosisBanner } from '@/components/catalog/product-grid'
import { plural } from '@/server/services/catalog/labels'
import { getConcernsIndex } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

export const metadata: Metadata = {
  title: 'Necesidades de la piel',
  description: 'Elegí lo que querés mejorar y te mostramos los productos que lo trabajan, con el motivo de cada uno.',
  alternates: { canonical: '/necesidades' },
}

// NAV-05: every need of the catalog, in the panel's order, each with its page.
export default async function ConcernsPage() {
  if (!(await canSeeCatalog())) return null
  const concerns = await getConcernsIndex()
  return (
    <>
      <PageIntro crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Necesidades' }]} eyebrow="Comprar por necesidad" title="¿Qué querés mejorar?" intro={['Elegí una necesidad y te mostramos los productos que la trabajan.']} />
      <section className="container-page mt-12" aria-label="Necesidades">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12">
          {concerns.map((c, i) => {
            const img = concernPortrait(c.code, i)
            return (
              <li key={c.code}>
                <Link href={`/necesidad/${c.code}`} className="group block">
                  <div className="shape-arch relative aspect-[3/4] overflow-hidden bg-sand">
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      sizes="(min-width: 1216px) 360px, (min-width: 1024px) 30vw, 46vw"
                      placeholder="blur"
                      blurDataURL={img.blur}
                      className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                    />
                  </div>
                  <div className="relative -mt-7 flex items-end justify-between px-3 sm:-mt-8 sm:px-4">
                    <IconBadge size="xl" tone="paper" className="size-14 ring-[5px] ring-paper sm:size-[4.5rem]">
                      <ConcernIcon slug={c.code} size={26} />
                    </IconBadge>
                    <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper sm:size-11">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <h2 className="mt-4 px-1 font-display text-[1.35rem] leading-tight sm:text-[1.5rem]">{c.name}</h2>
                  {c.shortDescription && <p className="mt-1.5 px-1 text-[0.9375rem] leading-snug text-ink-muted">{c.shortDescription}</p>}
                  <p className="mt-2 px-1 text-sm font-medium">{c.count > 0 ? plural(c.count, 'producto', 'productos') : 'Ver la página'}</p>
                </Link>
              </li>
            )
          })}
        </ul>
        <DiagnosisBanner title="¿No sabés por dónde empezar?" className="mt-20" />
      </section>
    </>
  )
}
