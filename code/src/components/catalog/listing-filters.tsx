'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatARS } from '@/lib/money'
import { Close, Info } from '@/components/icons'
import type { Facet } from '@/server/services/catalog/listing'
import { clearFilters, hasFilters, listingHref, listingQuery, patchState, type FilterGroup, type ListingState, type SortKey } from '@/server/services/catalog/listing-params'

type Props = {
  basePath: string
  extra?: Record<string, string>
  state: ListingState
  facets: Facet[]
  fragranceFree: { count: number; selected: boolean } | null
  priceBounds: { min: number; max: number } | null
  sorts: { value: SortKey; label: string }[]
  sort: SortKey
  total: number
}

// NAV-02: the filter form. One form serves both layouts: a sidebar from
// `lg`, and on phones a bottom sheet behind "Filtrar y ordenar" (S-14). Each
// change applies at once (the URL keeps the state) and the counts come back
// from the server; without JavaScript the form still submits as a GET.
export function ListingFilters({ basePath, extra, state, facets, fragranceFree, priceBounds, sorts, sort, total }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [local, setLocal] = useState(state)
  const [hydrated, setHydrated] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const serverKey = listingQuery(state)

  useEffect(() => setHydrated(true), [])
  // The server answered: its state is the truth again (keyed on the query, not the object identity).
  useEffect(() => setLocal(state), [serverKey])

  const go = (next: ListingState) => {
    const s = patchState(next, {})
    setLocal(s)
    startTransition(() => router.replace(listingHref(basePath, s, extra), { scroll: false }))
  }

  const toggle = (group: FilterGroup, value: string) => {
    const values = local[group].includes(value) ? local[group].filter((v) => v !== value) : [...local[group], value]
    go({ ...local, [group]: values })
  }

  const active = (['piel', 'necesidad', 'tipo', 'marca', 'momento', 'sello'] as const).reduce((n, g) => n + local[g].length, 0) + (local.sinFragancia ? 1 : 0) + (local.precioMin != null || local.precioMax != null ? 1 : 0)

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium hover:border-ink"
          aria-haspopup="dialog"
        >
          Filtrar y ordenar
          {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[0.6875rem] text-paper">{active}</span>}
        </button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="filtros-titulo"
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-3xl bg-paper p-0 text-ink backdrop:bg-ink/40 open:flex open:flex-col lg:static lg:mt-0 lg:block lg:max-h-none lg:w-auto lg:rounded-none lg:bg-transparent"
        onClick={(e) => {
          // A click on the backdrop closes the sheet.
          if (e.target === dialog.current) dialog.current?.close()
        }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 lg:hidden">
          <h2 id="filtros-titulo" className="text-base font-medium">
            Filtrar y ordenar
          </h2>
          <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-shell" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
            <Close size={20} />
          </button>
        </div>

        <form
          method="get"
          action={basePath}
          className="flex-1 overflow-y-auto px-5 pb-6 lg:overflow-visible lg:p-0"
          onSubmit={(e) => {
            if (!hydrated) return
            e.preventDefault()
            dialog.current?.close()
          }}
        >
          {Object.entries(extra ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 className="sr-only lg:not-sr-only lg:mb-2 lg:text-sm lg:font-medium">Filtros</h2>
          <div className="flex items-start gap-2 py-3 text-xs text-ink-muted">
            <details className="group">
              <summary className="inline-flex items-center gap-1.5 rounded-full underline-offset-2 hover:underline">
                <Info size={14} />
                Cómo filtramos
              </summary>
              <p className="mt-2 max-w-xs leading-relaxed">
                Dentro de un mismo grupo se suman las opciones (piel seca o sensible). Entre grupos se combinan (piel seca y que trabaje rojeces).
              </p>
            </details>
          </div>

          <fieldset className="border-t border-line py-4 lg:hidden">
            <legend className="float-left mb-2 w-full text-sm font-medium">Ordenar por</legend>
            <div className="clear-both space-y-1">
              {sorts.map((s) => (
                <label key={s.value} className="flex items-center gap-3 py-1.5 text-sm">
                  <input type="radio" name="orden" value={s.value} checked={(local.orden ?? sort) === s.value} onChange={() => go({ ...local, orden: s.value })} className="size-4 accent-ink" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          {facets.map((f) => (
            <fieldset key={f.group} className="border-t border-line py-4">
              <legend className="float-left mb-2 w-full text-sm font-medium">{f.label}</legend>
              <ul className="clear-both space-y-0.5">
                {f.options.map((o) => {
                  const checked = local[f.group].includes(o.value)
                  return (
                    <li key={o.value} style={{ paddingLeft: `${o.depth * 1}rem` }}>
                      <label className={`flex items-center gap-3 py-1.5 text-sm ${o.count === 0 && !checked ? 'text-ink-muted' : ''}`}>
                        <input
                          type="checkbox"
                          name={f.group}
                          value={o.value}
                          checked={checked}
                          disabled={o.count === 0 && !checked}
                          onChange={() => toggle(f.group, o.value)}
                          className="size-4 shrink-0 rounded accent-ink"
                        />
                        <span className="flex-1">{o.label}</span>
                        <span className="tabular text-xs text-ink-muted" aria-label={`${o.count} ${o.count === 1 ? 'producto' : 'productos'}`}>
                          {o.count}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          ))}

          {priceBounds && priceBounds.max > priceBounds.min && (
            <PriceRange
              key={`${priceBounds.min}-${priceBounds.max}-${state.precioMin}-${state.precioMax}`}
              bounds={priceBounds}
              min={local.precioMin}
              max={local.precioMax}
              onCommit={(precioMin, precioMax) => go({ ...local, precioMin, precioMax })}
            />
          )}

          {fragranceFree && (
            <fieldset className="border-t border-line py-4">
              <legend className="sr-only">Fragancia</legend>
              <label className={`flex items-center gap-3 py-1.5 text-sm ${fragranceFree.count === 0 && !local.sinFragancia ? 'text-ink-muted' : ''}`}>
                <input
                  type="checkbox"
                  name="sin_fragancia"
                  value="1"
                  checked={local.sinFragancia}
                  disabled={fragranceFree.count === 0 && !local.sinFragancia}
                  onChange={() => go({ ...local, sinFragancia: !local.sinFragancia })}
                  className="size-4 shrink-0 rounded accent-ink"
                />
                <span className="flex-1 font-medium">Sin fragancia</span>
                <span className="tabular text-xs text-ink-muted">{fragranceFree.count}</span>
              </label>
            </fieldset>
          )}

          {!hydrated && (
            <button type="submit" className="mt-2 hidden h-10 rounded-full bg-ink px-5 text-sm font-medium text-paper lg:inline-flex lg:items-center">
              Aplicar filtros
            </button>
          )}
          <p className="sr-only" aria-live="polite">
            {pending ? 'Actualizando resultados' : ''}
          </p>
        </form>

        <div className="flex items-center gap-3 border-t border-line px-5 py-4 lg:hidden">
          {hasFilters(local) && (
            <button type="button" className="h-12 rounded-full px-4 text-sm underline underline-offset-2" onClick={() => go(clearFilters(local))}>
              Limpiar filtros
            </button>
          )}
          <button
            type="button"
            className="ml-auto inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper disabled:opacity-60"
            onClick={() => dialog.current?.close()}
            disabled={pending}
          >
            {pending ? 'Actualizando…' : `Ver ${total} ${total === 1 ? 'producto' : 'productos'}`}
          </button>
        </div>
      </dialog>
    </div>
  )
}

/** Two thumbs over the catalog's own minimum and maximum (S-08), applied when released. */
function PriceRange({ bounds, min, max, onCommit }: { bounds: { min: number; max: number }; min: number | null; max: number | null; onCommit: (min: number | null, max: number | null) => void }) {
  const span = bounds.max - bounds.min
  const step = span > 200_000 ? 1000 : span > 20_000 ? 500 : span > 2000 ? 100 : 1
  // A range input only stops on min + n × step, so the top stop may sit just
  // under the maximum: reaching it means "no upper limit".
  const top = bounds.min + Math.floor(span / step) * step
  const clamp = (v: number) => Math.min(top, Math.max(bounds.min, v))
  const [lo, setLo] = useState(clamp(min ?? bounds.min))
  const [hi, setHi] = useState(max == null ? top : clamp(max))
  const commit = (a = lo, b = hi) => onCommit(a <= bounds.min ? null : a, b >= top ? null : b)
  const pct = (v: number) => ((v - bounds.min) / (top - bounds.min)) * 100
  const thumb =
    'pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-paper [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-paper [&::-moz-range-thumb]:bg-ink'
  const events = (a: () => number, b: () => number) => ({
    onPointerUp: () => commit(a(), b()),
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) commit(a(), b())
    },
  })
  return (
    <fieldset className="border-t border-line py-4">
      <legend className="float-left mb-3 w-full text-sm font-medium">Precio</legend>
      <p className="clear-both flex justify-between text-sm tabular text-ink-soft" aria-hidden="true">
        <span>{formatARS(lo * 100)}</span>
        <span>{formatARS((hi >= top ? bounds.max : hi) * 100)}</span>
      </p>
      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input
          type="range"
          aria-label="Precio mínimo"
          aria-valuetext={formatARS(lo * 100)}
          min={bounds.min}
          max={top}
          step={step}
          value={lo}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi))}
          className={thumb}
          {...events(() => lo, () => hi)}
        />
        <input
          type="range"
          aria-label="Precio máximo"
          aria-valuetext={formatARS((hi >= top ? bounds.max : hi) * 100)}
          min={bounds.min}
          max={top}
          step={step}
          value={hi}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo))}
          className={thumb}
          {...events(() => lo, () => hi)}
        />
      </div>
      {/* What a GET submission without JavaScript sends. */}
      {lo > bounds.min && <input type="hidden" name="precio_min" value={lo} />}
      {hi < top && <input type="hidden" name="precio_max" value={hi} />}
    </fieldset>
  )
}
