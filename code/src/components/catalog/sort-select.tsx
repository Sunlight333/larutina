'use client'

import { useId, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { listingHref, patchState, type ListingState, type SortKey } from '@/server/services/catalog/listing-params'
import { Select } from '@/components/ui/select'

/** NAV-03: the sort, on desktop, in the site's own dropdown. On phones it sits in the filter sheet. */
export function SortSelect({ basePath, extra, state, sorts, sort }: { basePath: string; extra?: Record<string, string>; state: ListingState; sorts: { value: SortKey; label: string }[]; sort: SortKey }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const labelId = useId()
  return (
    <div className="hidden items-center gap-3 text-[0.9375rem] font-medium text-ink-soft lg:flex">
      <span id={labelId}>Ordenar por</span>
      <Select
        size="sm"
        labelledBy={labelId}
        className="w-56"
        options={sorts}
        value={sort}
        onChange={(v) => {
          const next = patchState(state, { orden: v as SortKey })
          startTransition(() => router.replace(listingHref(basePath, next, extra), { scroll: false }))
        }}
      />
    </div>
  )
}
