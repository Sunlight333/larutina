'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { listingHref, patchState, type ListingState, type SortKey } from '@/server/services/catalog/listing-params'

/** NAV-03: the sort, on desktop. On phones it sits in the filter sheet. */
export function SortSelect({ basePath, extra, state, sorts, sort }: { basePath: string; extra?: Record<string, string>; state: ListingState; sorts: { value: SortKey; label: string }[]; sort: SortKey }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  return (
    <label className="hidden items-center gap-2 text-sm text-ink-soft lg:flex">
      Ordenar por
      <select
        value={sort}
        onChange={(e) => {
          const next = patchState(state, { orden: e.target.value as SortKey })
          startTransition(() => router.replace(listingHref(basePath, next, extra), { scroll: false }))
        }}
        className="h-10 rounded-full border border-line-strong bg-paper px-4 pr-8 text-sm text-ink"
      >
        {sorts.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}
