import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@/components/icons'
import { PageIntro } from '@/components/catalog/page-intro'
import { plural } from '@/server/services/catalog/labels'
import { firstSentence } from '@/server/services/catalog/rules'
import { getBrandsIndex } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

export async function generateMetadata(): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const brands = await getBrandsIndex()
  return {
    title: 'Nuestras marcas',
    description: `${plural(brands.length, 'marca', 'marcas')}, elegidas una por una por cómo formulan y por qué tan claro cuentan lo que lleva cada producto.`,
    alternates: { canonical: '/marcas' },
  }
}

// S-32 (IR-04): brands with published products; card with logo, one line and "Ver productos".
export default async function BrandsPage() {
  if (!(await canSeeCatalog())) return null
  const brands = await getBrandsIndex()
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Marcas' }]}
        title="Nuestras marcas"
        intro={[`${plural(brands.length, 'marca', 'marcas')}, elegidas una por una por cómo formulan y por qué tan claro cuentan lo que lleva cada producto.`]}
      />
      <section className="container-page mt-10 md:mt-12" aria-label="Marcas">
        {brands.length === 0 ? (
          <p className="text-ink-soft">Pronto vas a encontrar acá nuestras marcas.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <li key={b.code}>
                <Link href={`/marca/${b.code}`} className="group flex h-full flex-col rounded-[2rem] bg-shell p-6 transition-colors hover:bg-sand">
                  <span className="flex h-14 items-center">
                    {b.logo ? (
                      <Image src={b.logo.src} alt="" width={b.logo.width} height={b.logo.height} sizes="10rem" className="h-12 w-auto max-w-[10rem] object-contain" />
                    ) : (
                      <span className="font-display text-display-sm" aria-hidden="true">
                        {b.name}
                      </span>
                    )}
                  </span>
                  <span className={b.logo ? 'mt-4 font-display text-display-sm' : 'sr-only'}>{b.name}</span>
                  <span className="mt-2 flex-1 text-sm text-ink-soft">
                    {firstSentence(b.description) || [b.countryOfOrigin, plural(b.count, 'producto', 'productos')].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                    Ver productos
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
