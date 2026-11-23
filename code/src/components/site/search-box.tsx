import Link from 'next/link'
import { Search } from '@/components/icons'

// Placeholder: the storefront track replaces this with the autocomplete
// search (NAV-06). Keep the props.
export function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <Link href="/buscar" aria-label="Buscar" title={placeholder} className="grid size-10 place-items-center rounded-full hover:bg-shell">
      <Search size={20} />
    </Link>
  )
}
