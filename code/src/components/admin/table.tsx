import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmptyState } from './ui'

// Generic list: columns + rows, a GET search box and page links that keep the
// other query parameters. Server components only; state lives in the URL.

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string }

export function DataTable<T>({ columns, rows, rowKey, empty = 'No hay nada para mostrar.' }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: string }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-shell/60 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-2.5 font-medium ${c.className ?? ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-shell/40">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 align-top ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export type SearchParams = Record<string, string | string[] | undefined>

export const param = (sp: SearchParams, key: string) => {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

export function pageOf(sp: SearchParams, size = 50) {
  const page = Math.max(1, Number(param(sp, 'pagina')) || 1)
  return { page, skip: (page - 1) * size, take: size, size }
}

function hrefWith(basePath: string, sp: SearchParams, changes: Record<string, string | null>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v !== '') q.set(k, v)
  for (const [k, v] of Object.entries(changes)) (v === null ? q.delete(k) : q.set(k, v))
  const s = q.toString()
  return s ? `${basePath}?${s}` : basePath
}

export function Pagination({ basePath, sp, total, page, size }: { basePath: string; sp: SearchParams; total: number; page: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return <p className="mt-3 text-sm text-ink-muted">{total} en total</p>
  return (
    <nav className="mt-3 flex items-center gap-3 text-sm" aria-label="Páginas">
      <span className="text-ink-muted">
        {total} en total · página {page} de {pages}
      </span>
      {page > 1 && (
        <Link className="underline" href={hrefWith(basePath, sp, { pagina: String(page - 1) })}>
          Anterior
        </Link>
      )}
      {page < pages && (
        <Link className="underline" href={hrefWith(basePath, sp, { pagina: String(page + 1) })}>
          Siguiente
        </Link>
      )}
    </nav>
  )
}

/** GET filter bar: a search box plus optional selects; submitting resets the page. */
export function FilterBar({ sp, placeholder = 'Buscar…', selects = [] }: { sp: SearchParams; placeholder?: string; selects?: { name: string; label: string; options: { value: string; label: string }[] }[] }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
      <label className="min-w-[14rem] flex-1">
        <span className="sr-only">Buscar</span>
        <input name="q" defaultValue={param(sp, 'q') ?? ''} placeholder={placeholder} className="h-9 w-full rounded-lg border border-line-strong bg-paper px-3 text-sm" />
      </label>
      {selects.map((s) => (
        <label key={s.name} className="text-sm">
          <span className="sr-only">{s.label}</span>
          <select name={s.name} defaultValue={param(sp, s.name) ?? ''} className="h-9 rounded-lg border border-line-strong bg-paper px-2 text-sm">
            <option value="">{s.label}: todos</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button className="h-9 rounded-lg border border-line-strong bg-paper px-3 text-sm font-medium hover:border-ink">Filtrar</button>
    </form>
  )
}
