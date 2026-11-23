import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListingView } from '@/components/catalog/listing-view'
import { PageIntro } from '@/components/catalog/page-intro'
import { browse } from '@/server/services/catalog/browse'
import { parseListingState, type RawSearchParams } from '@/server/services/catalog/listing-params'
import { firstSentence, paragraphs } from '@/server/services/catalog/rules'
import { getConcernPage } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'
import { concernPortrait } from '@/lib/images'

type Props = { params: Promise<{ code: string }>; searchParams: Promise<RawSearchParams> }

// S-34: "[Necesidad] · Larutina Beauty", description from the first sentence of the intro.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const concern = await getConcernPage((await params).code)
  if (!concern) return {}
  return {
    title: concern.name,
    description: firstSentence(concern.editorialContent) || firstSentence(concern.shortDescription) || undefined,
    alternates: { canonical: `/necesidad/${concern.code}` },
  }
}

// NAV-05, S-22: H1, editorial intro (Necesidades.contenido_editorial), filtered grid, diagnosis banner.
export default async function ConcernPage({ params, searchParams }: Props) {
  if (!(await canSeeCatalog())) return null
  const concern = await getConcernPage((await params).code)
  if (!concern) notFound()
  const result = await browse(parseListingState(await searchParams), { concern: concern.code })
  const intro = paragraphs(concern.editorialContent)
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Necesidades', href: '/necesidades' }, { label: concern.name }]}
        eyebrow="Necesidad"
        title={concern.name}
        image={concernPortrait(concern.code)}
        intro={intro.length ? intro : paragraphs(concern.shortDescription)}
      />
      <section className="container-page" aria-label="Productos">
        <ListingView basePath={`/necesidad/${concern.code}`} result={result} emptyText="Todavía no tenemos productos para esta necesidad. El diagnóstico te arma una rutina con lo que hay." />
      </section>
    </>
  )
}
