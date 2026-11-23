import type { Metadata } from 'next'
import { ListingView } from '@/components/catalog/listing-view'
import { PageIntro } from '@/components/catalog/page-intro'
import { browse } from '@/server/services/catalog/browse'
import { getCatalog } from '@/server/services/catalog/catalog'
import { parseListingState, type RawSearchParams } from '@/server/services/catalog/listing-params'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

type Props = { searchParams: Promise<RawSearchParams> }

// S-31. Filtered views point at the plain listing as canonical.
export async function generateMetadata(): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const n = (await getCatalog()).length
  return {
    title: 'Productos de skincare coreano',
    description: `${n} productos de skincare coreano, elegidos uno por uno. Filtrá por tipo de piel y lo que querés mejorar.`,
    alternates: { canonical: '/productos' },
  }
}

// NAV-02, NAV-03: the full listing (S-01 to S-21).
export default async function ProductsPage({ searchParams }: Props) {
  if (!(await canSeeCatalog())) return null
  const state = parseListingState(await searchParams)
  const [result, catalog] = await Promise.all([browse(state), getCatalog()])
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]}
        title="Todos los productos"
        intro={[
          `${catalog.length} productos, elegidos uno por uno. Filtrá por tu tipo de piel y lo que querés mejorar, o dejá que el diagnóstico arme la rutina por vos.`,
        ]}
      />
      <section className="container-page" aria-label="Productos">
        <ListingView basePath="/productos" result={result} />
      </section>
    </>
  )
}
