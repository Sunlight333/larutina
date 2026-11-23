import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ConcernIcon, IconBadge } from '@/components/icons'
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

// The icon set is keyed by short names; need codes come from the catalog.
const ICON_KEYS = ['acne', 'manchas', 'deshidratacion', 'sensibilidad', 'rojeces', 'lineas', 'poros']
const iconFor = (code: string) => {
  const key = ICON_KEYS.find((k) => code.includes(k)) ?? code
  return key === 'rojeces' ? 'sensibilidad' : key
}

// NAV-05: every need of the catalog, in the panel's order, each with its page.
export default async function ConcernsPage() {
  if (!(await canSeeCatalog())) return null
  const concerns = await getConcernsIndex()
  return (
    <>
      <PageIntro crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Necesidades' }]} title="¿Qué querés mejorar?" intro={['Elegí una necesidad y te mostramos los productos que la trabajan.']} />
      <section className="container-page" aria-label="Necesidades">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {concerns.map((c) => (
            <li key={c.code}>
              <Link href={`/necesidad/${c.code}`} className="group flex h-full items-start gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5 transition-colors hover:border-ink">
                <IconBadge tone="accent">
                  <ConcernIcon slug={iconFor(c.code)} size={22} />
                </IconBadge>
                <span className="flex-1">
                  <span className="block font-display text-display-sm">{c.name}</span>
                  {c.shortDescription && <span className="mt-1.5 block text-sm text-ink-soft">{c.shortDescription}</span>}
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
                    {c.count > 0 ? plural(c.count, 'producto', 'productos') : 'Ver la página'}
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <DiagnosisBanner title="¿No sabés por dónde empezar?" className="mt-14" />
      </section>
    </>
  )
}
