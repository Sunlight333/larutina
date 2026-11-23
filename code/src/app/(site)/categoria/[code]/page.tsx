import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListingView } from '@/components/catalog/listing-view'
import { PageIntro } from '@/components/catalog/page-intro'
import { browse } from '@/server/services/catalog/browse'
import { parseListingState, type RawSearchParams } from '@/server/services/catalog/listing-params'
import { firstSentence, paragraphs } from '@/server/services/catalog/rules'
import { getCategoryPage } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

type Props = { params: Promise<{ code: string }>; searchParams: Promise<RawSearchParams> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const category = await getCategoryPage((await params).code)
  if (!category) return {}
  return {
    title: category.name,
    description: firstSentence(category.description) || `${category.name}: los productos que elegimos, con el motivo de cada uno.`,
    alternates: { canonical: `/categoria/${category.code}` },
  }
}

// NAV-05: a category with its subcategories (IR-04), intro from Categorias.descripcion.
export default async function CategoryPage({ params, searchParams }: Props) {
  if (!(await canSeeCatalog())) return null
  const category = await getCategoryPage((await params).code)
  if (!category) notFound()
  const result = await browse(parseListingState(await searchParams), { category: category.code })
  return (
    <>
      <PageIntro
        crumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/productos' },
          ...(category.parent ? [{ label: category.parent.name, href: `/categoria/${category.parent.code}` }] : []),
          { label: category.name },
        ]}
        title={category.name}
        intro={paragraphs(category.description)}
      />
      <section className="container-page" aria-label="Productos">
        <ListingView basePath={`/categoria/${category.code}`} result={result} emptyText="Pronto vas a encontrar productos de esta categoría." />
      </section>
    </>
  )
}
