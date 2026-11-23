import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Search } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ListingView } from '@/components/catalog/listing-view'
import { getSettings } from '@/server/settings'
import { getSearchProvider } from '@/server/search'
import { browse } from '@/server/services/catalog/browse'
import { parseListingState, type RawSearchParams } from '@/server/services/catalog/listing-params'
import { plural } from '@/server/services/catalog/labels'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

type Props = { searchParams: Promise<RawSearchParams> }

const term = (sp: RawSearchParams) => {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q
  return (q ?? '').trim().slice(0, 100)
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (!(await canSeeCatalog())) return {}
  const q = term(await searchParams)
  return { title: q ? `Resultados para “${q}”` : 'Buscar', robots: { index: false, follow: true } }
}

// NAV-06, S-33: the results with the listing's grid, filters and sort;
// "Ver todo para [necesidad]" when the query names one; G-05 when nothing matches.
export default async function SearchPage({ searchParams }: Props) {
  if (!(await canSeeCatalog())) return null
  const sp = await searchParams
  const q = term(sp)
  const s = await getSettings()
  const found = q ? await getSearchProvider().search(q) : null
  const rank = new Map(found?.products.map((p, i) => [p.code, i]))
  const result = found && found.products.length ? await browse(parseListingState(sp), { rank }) : null

  return (
    <>
      <header className="container-page pb-8 pt-8 sm:pt-12">
        <form role="search" action="/buscar" method="get" className="flex max-w-2xl items-center gap-2 rounded-full border border-line-strong bg-paper py-1.5 pl-5 pr-1.5 focus-within:border-ink">
          <Search size={20} className="shrink-0 text-ink-muted" />
          <label htmlFor="buscar-q" className="sr-only">
            Buscar
          </label>
          <input id="buscar-q" name="q" type="search" defaultValue={q} placeholder={s['copy.searchPlaceholder']} maxLength={100} className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted" />
          <button type="submit" className="h-10 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-soft">
            Buscar
          </button>
        </form>

        {q && (
          <h1 className="mt-8 font-display text-display-md text-balance">
            Resultados para “{q}”
            {result && <span className="mt-2 block font-sans text-base text-ink-soft">{plural(result.total, 'producto', 'productos')}</span>}
          </h1>
        )}
        {!q && <h1 className="mt-8 font-display text-display-md">¿Qué estás buscando?</h1>}

        {found?.concern && (
          <Link href={`/necesidad/${found.concern.code}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-shell px-5 py-2.5 text-sm font-medium hover:bg-sand">
            Ver todo para {found.concern.name}
            <ArrowRight size={16} />
          </Link>
        )}
      </header>

      <section className="container-page" aria-label="Resultados">
        {q && !result && (
          <div className="rounded-[var(--radius-card)] bg-shell px-6 py-12 text-center">
            <p className="mx-auto max-w-xl text-lede text-ink-soft">
              No encontramos nada con “{q}”. Probá con otra palabra, o hacé el diagnóstico y te armamos la rutina.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/diagnostico">Hacer mi diagnóstico</ButtonLink>
              <ButtonLink href="/productos" variant="secondary">
                Ver todos los productos
              </ButtonLink>
            </div>
          </div>
        )}
        {result && <ListingView basePath="/buscar" extra={{ q }} result={result} />}
      </section>
    </>
  )
}
