import Link from 'next/link'
import { formatARS } from '@/lib/money'
import { Close, ConcernIcon, Search } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import type { BrowseResult } from '@/server/services/catalog/browse'
import { FILTER_GROUPS, clearFilters, hasFilters, listingHref, patchState, type FilterGroup, type ListingState } from '@/server/services/catalog/listing-params'
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

// The groups shown as chip rows in the filter bar, as in the design: skin
// type and need (on a need's page, where need is fixed, the moment). The
// rest, with the price and the sort on phones, open from "Más filtros".
const BAR_GROUPS: FilterGroup[] = ['piel', 'necesidad', 'momento']

/**
 * The listing (NAV-02..04, S-03 to S-21) in the approved design: a sticky
 * filter bar with chips, count and sort, active filters, the grid with the
 * diagnosis banner, empty state and "Ver más productos".
 */
export function ListingView({ basePath, result, extra, emptyText }: { basePath: string; result: BrowseResult; extra?: Record<string, string>; emptyText?: string }) {
  const state = result.state
  const active = chips(basePath, result, extra)
  const filtered = hasFilters(state)
  const rows = BAR_GROUPS.flatMap((g) => result.facets.find((f) => f.group === g && f.options.length > 1) ?? []).slice(0, 2)
  const toggle = (g: FilterGroup, v: string) =>
    listingHref(basePath, patchState(state, { [g]: state[g].includes(v) ? state[g].filter((x) => x !== v) : [...state[g], v] }), extra)

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-b border-line/70 bg-paper/92 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-[4.25rem] lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0 space-y-3">
            {rows.map((f) => (
              <div key={f.group} className="flex items-center gap-3">
                <p className="hidden w-24 shrink-0 text-[0.8125rem] font-medium text-ink-muted md:block">{f.label}</p>
                <div className="scroller -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label={f.label}>
                  {f.options.map((o) => {
                    const on = state[f.group].includes(o.value)
                    const cls = `inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors ${
                      on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-ink-soft hover:border-ink/60 hover:text-ink'
                    }`
                    const body = (
                      <>
                        {f.group === 'necesidad' && <ConcernIcon slug={o.value} size={16} />}
                        {o.label}
                        <span className={`tabular text-[0.75rem] ${on ? 'text-paper/70' : 'text-ink-muted'}`} aria-label={`${o.count} ${o.count === 1 ? 'producto' : 'productos'}`}>
                          {o.count}
                        </span>
                      </>
                    )
                    return o.count === 0 && !on ? (
                      <span key={o.value} className={`${cls} pointer-events-none opacity-45`} aria-disabled="true">
                        {body}
                      </span>
                    ) : (
                      <Link key={o.value} href={toggle(f.group, o.value)} scroll={false} replace aria-current={on ? 'true' : undefined} className={cls}>
                        {body}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
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
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.9375rem] text-ink-soft" role="status">
          <span className="tabular font-medium text-ink">{result.total.toLocaleString('es-AR')}</span> {result.total === 1 ? 'producto' : 'productos'}
        </p>
        <div className="flex items-center gap-4">
          {filtered && (
            <Link
              href={listingHref(basePath, clearFilters(state), extra)}
              scroll={false}
              replace
              className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              <Close size={14} />
              Limpiar filtros
            </Link>
          )}
          <SortSelect basePath={basePath} extra={extra} state={state} sorts={result.sorts} sort={result.sort} />
        </div>
      </div>

      {active.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h2 className="sr-only">Filtros activos</h2>
          <ul className="contents">
            {active.map((c) => (
              <li key={c.href + c.label}>
                <Link href={c.href} scroll={false} replace className="inline-flex h-8 items-center gap-1.5 rounded-full bg-shell pl-3 pr-2 text-sm hover:bg-sand" aria-label={`Quitar filtro: ${c.label}`}>
                  {c.label}
                  <Close size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="sr-only">Resultados</h2>
      <div className="mt-8">
        {result.total === 0 ? (
          <div className="flex flex-col items-center rounded-[2rem] bg-shell px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-paper text-ink-muted">
              <Search size={26} />
            </span>
            <p className="mt-5 max-w-md font-display text-display-sm text-balance">
              {filtered ? 'No hay productos para esa combinación.' : (emptyText ?? 'Todavía no hay productos acá.')}
            </p>
            {filtered && <p className="mt-2 max-w-md text-ink-muted">Probá sacando algún filtro.</p>}
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
        <div className="mt-14 flex flex-col items-center gap-3">
          <p className="text-sm text-ink-muted">
            Estás viendo {result.items.length} de {result.total}
          </p>
          <ButtonLink href={listingHref(basePath, { ...state, pagina: state.pagina + 1 }, extra)} variant="secondary" scroll={false}>
            Ver más productos
          </ButtonLink>
        </div>
      )}
      {result.total > 0 && result.total <= 8 && <DiagnosisBanner className="mt-20" />}
      <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-muted">
        Cómo filtramos: dentro de un mismo grupo, las opciones se suman (piel seca o sensible); entre grupos, se combinan (piel seca y que trabaje rojeces).
      </p>
    </div>
  )
}
