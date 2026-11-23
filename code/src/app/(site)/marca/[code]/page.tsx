import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ListingView } from '@/components/catalog/listing-view'
import { PageIntro } from '@/components/catalog/page-intro'
import { browse } from '@/server/services/catalog/browse'
import { parseListingState, type RawSearchParams } from '@/server/services/catalog/listing-params'
import { firstSentence, paragraphs } from '@/server/services/catalog/rules'
import { getBrandPage } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

type Props = { params: Promise<{ code: string }>; searchParams: Promise<RawSearchParams> }

// S-34: "[Marca] · Larutina Beauty", description from the first sentence of its description.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const brand = await getBrandPage((await params).code)
  if (!brand) return {}
  return {
    title: brand.name,
    description: firstSentence(brand.description) || `Los productos de ${brand.name} que elegimos, con el motivo de cada uno.`,
    alternates: { canonical: `/marca/${brand.code}` },
  }
}

// NAV-05, S-30: H1, brand description (Marcas.descripcion), the brand's grid.
export default async function BrandPage({ params, searchParams }: Props) {
  if (!(await canSeeCatalog())) return null
  const brand = await getBrandPage((await params).code)
  if (!brand) notFound()
  const result = await browse(parseListingState(await searchParams), { brand: brand.code })
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Marcas', href: '/marcas' }, { label: brand.name }]}
        eyebrow={brand.countryOfOrigin ? `Marca de ${brand.countryOfOrigin}` : undefined}
        title={brand.name}
        intro={paragraphs(brand.description)}
      >
        {brand.logo && (
          <Image src={brand.logo.src} alt={`Logo de ${brand.name}`} width={brand.logo.width} height={brand.logo.height} sizes="10rem" className="mt-6 h-12 w-auto object-contain" />
        )}
      </PageIntro>
      <section className="container-page" aria-label={`Productos de ${brand.name}`}>
        <ListingView basePath={`/marca/${brand.code}`} result={result} emptyText={`Pronto vas a encontrar acá los productos de ${brand.name}.`} />
      </section>
    </>
  )
}
