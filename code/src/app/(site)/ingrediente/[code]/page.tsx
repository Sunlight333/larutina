import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Alert } from '@/components/icons'
import { PageIntro } from '@/components/catalog/page-intro'
import { ProductGrid } from '@/components/catalog/product-grid'
import { toCards } from '@/server/services/catalog/cards'
import { plural } from '@/server/services/catalog/labels'
import { firstSentence, lowerFirst, paragraphs } from '@/server/services/catalog/rules'
import { getIngredientPage } from '@/server/services/catalog/taxonomy'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

type Props = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const ing = await getIngredientPage((await params).code)
  if (!ing) return {}
  return { title: ing.commonName, description: firstSentence(ing.description), alternates: { canonical: `/ingrediente/${ing.code}` } }
}

// NAV-05: description, the family warning, what it works and the products
// that carry it, star ingredients first.
export default async function IngredientPage({ params }: Props) {
  if (!(await canSeeCatalog())) return null
  const ing = await getIngredientPage((await params).code)
  if (!ing) notFound()
  const cards = await toCards(ing.products)
  const stars = cards.filter((c) => ing.starCodes.has(c.code))
  const others = cards.filter((c) => !ing.starCodes.has(c.code))
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Productos', href: '/productos' }, { label: ing.commonName }]}
        eyebrow={ing.family ? `Ingrediente · ${ing.family.name}` : 'Ingrediente'}
        title={ing.commonName}
        intro={paragraphs(ing.description)}
      >
        <p className="mt-4 text-sm text-ink-muted">
          En la lista de ingredientes (INCI): <span className="text-ink-soft">{ing.inciName}</span>
        </p>
        {ing.family?.warning && (
          <p className="mt-5 flex max-w-2xl items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
            <Alert size={18} className="mt-0.5 shrink-0 text-accent-ink" />
            <span>{ing.family.warning}</span>
          </p>
        )}
        {ing.concerns.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium">Para qué se usa</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {ing.concerns.map((c) => (
                <li key={c.code}>
                  <Link href={`/necesidad/${c.code}`} className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:border-ink">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageIntro>

      <section className="container-page mt-10 space-y-14 md:mt-12" aria-label="Productos con este ingrediente">
        {cards.length === 0 && <p className="text-ink-soft">Todavía no tenemos productos con {lowerFirst(ing.commonName)}.</p>}
        {stars.length > 0 && (
          <div>
            <h2 className="font-display text-display-sm">Lo tienen como ingrediente estrella</h2>
            <p className="mt-1 text-sm text-ink-muted">{plural(stars.length, 'producto', 'productos')}</p>
            <div className="mt-6">
              <ProductGrid products={stars} eagerFirst={2} />
            </div>
          </div>
        )}
        {others.length > 0 && (
          <div>
            <h2 className="font-display text-display-sm">{stars.length ? 'También lo llevan' : 'Productos que lo llevan'}</h2>
            <p className="mt-1 text-sm text-ink-muted">{plural(others.length, 'producto', 'productos')}</p>
            <div className="mt-6">
              <ProductGrid products={others} />
            </div>
          </div>
        )}
      </section>
    </>
  )
}
