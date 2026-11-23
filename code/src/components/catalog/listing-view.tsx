import Link from 'next/link'
import { formatARS } from '@/lib/money'
import { Close } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import type { BrowseResult } from '@/server/services/catalog/browse'
import { FILTER_GROUPS, clearFilters, hasFilters, listingHref, patchState, type ListingState } from '@/server/services/catalog/listing-params'
import { plural } from '@/server/services/catalog/labels'
import { ListingFilters } from './listing-filters'
import { SortSelect } from './sort-select'
import { DiagnosisBanner, ProductGrid } from './product-grid'

type Chip = { label: string; href: string }

function chips(basePath: string, result: BrowseResult, extra?: Record<string, string>): Chip[] {
  const s = result.state
  const href = (next: ListingState) => listingHref(basePath, patchState(next, {}), extra)
  const out: Chip[] = []
  for (const g of FILTER_GROUPS) {
    const labels = new Map(result.facets.find((f) => f.group === g)?.options.map((o) => [o.value, o.label]))
    for (const v of s[g]) {
      const label = labels.get(v)
      if (label) out.push({ label, href: href({ ...s, [g]: s[g].filter((x) => x !== v) }) })
    }
  }
  if (s.precioMin != null || s.precioMax != null) {
    const label =
      s.precioMin != null && s.precioMax != null
        ? `${formatARS(s.precioMin * 100)} a ${formatARS(s.precioMax * 100)}`
        : s.precioMin != null
          ? `Desde ${formatARS(s.precioMin * 100)}`
          : `Hasta ${formatARS(s.precioMax! * 100)}`
    out.push({ label, href: href({ ...s, precioMin: null, precioMax: null }) })
  }
  if (s.sinFragancia) out.push({ label: 'Sin fragancia', href: href({ ...s, sinFragancia: false }) })
  return out
}

/**
 * The listing (NAV-02..04, S-03 to S-21): filters, active chips, sort, count,
 * grid with the diagnosis banner, empty state and "Ver más productos".
 */
export function ListingView({ basePath, result, extra, emptyText }: { basePath: string; result: BrowseResult; extra?: Record<string, string>; emptyText?: string }) {
  const state = result.state
  const active = chips(basePath, result, extra)
  const filtered = hasFilters(state)
  return (
    <div className="lg:grid lg:grid-cols-[14.5rem_1fr] lg:gap-12">
      <ListingFilters
        basePath={basePath}
        extra={extra}
        state={state}
        facets={result.facets}
        fragranceFree={result.fragranceFree}
        priceBounds={result.priceBounds}
        sorts={result.sorts}
        sort={result.sort}
        total={result.total}
      />

      <div className="mt-6 min-w-0 lg:mt-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-soft" role="status">
            {plural(result.total, 'producto', 'productos')}
          </p>
          <SortSelect basePath={basePath} extra={extra} state={state} sorts={result.sorts} sort={result.sort} />
        </div>

        {active.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h2 className="sr-only">Filtros activos</h2>
            <ul className="contents">
              {active.map((c) => (
                <li key={c.href + c.label}>
                  <Link
                    href={c.href}
                    scroll={false}
                    replace
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-shell pl-3 pr-2 text-sm hover:bg-sand"
                    aria-label={`Quitar filtro: ${c.label}`}
                  >
                    {c.label}
                    <Close size={14} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={listingHref(basePath, clearFilters(state), extra)} scroll={false} replace className="px-2 text-sm underline underline-offset-2 hover:text-ink-soft">
              Limpiar filtros
            </Link>
          </div>
        )}

        <div className="mt-6">
          {result.total === 0 ? (
            <div className="rounded-[var(--radius-card)] bg-shell px-6 py-12 text-center">
              <p className="mx-auto max-w-md text-lede text-ink-soft">
                {filtered ? 'No hay productos con esta combinación. Probá sacando algún filtro.' : (emptyText ?? 'Todavía no hay productos acá.')}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {filtered && (
                  <ButtonLink href={listingHref(basePath, clearFilters(state), extra)} variant="secondary" scroll={false}>
                    Limpiar filtros
                  </ButtonLink>
                )}
                <ButtonLink href="/diagnostico">Hacer mi diagnóstico</ButtonLink>
              </div>
            </div>
          ) : (
            <ProductGrid products={result.cards} banner={result.total > 8 ? <DiagnosisBanner /> : undefined} eagerFirst={state.pagina === 1 ? 2 : 0} />
          )}
        </div>

        {result.hasMore && (
          <div className="mt-12 flex flex-col items-center gap-3">
            <p className="text-sm text-ink-muted">
              Estás viendo {result.items.length} de {result.total}
            </p>
            <ButtonLink href={listingHref(basePath, { ...state, pagina: state.pagina + 1 }, extra)} variant="secondary" scroll={false}>
              Ver más productos
            </ButtonLink>
          </div>
        )}
        {result.total > 0 && result.total <= 8 && <DiagnosisBanner className="mt-14" />}
      </div>
    </div>
  )
}
