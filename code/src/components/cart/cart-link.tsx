import Link from 'next/link'
import { Bag } from '@/components/icons'

// Placeholder: the storefront track replaces this with the cart count (G-03).
export function CartLink() {
  return (
    <Link href="/carrito" aria-label="Carrito" className="grid size-10 place-items-center rounded-full hover:bg-shell">
      <Bag size={20} />
    </Link>
  )
}
