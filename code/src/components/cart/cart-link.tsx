'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bag, Close } from '@/components/icons'
import { ButtonLink, buttonClasses } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { formatARS } from '@/lib/money'
import { cartCount, onAdded, useCart, type AddedItem } from './store'
import { subtotalCents, useCartItems } from './use-cart-items'

// G-03: the header cart with its count ("Carrito, [n] productos"), and G-07:
// the side panel that opens after adding a product.
export function CartLink() {
  const lines = useCart()
  const n = cartCount(lines)
  return (
    <>
      <Link href="/carrito" aria-label={`Carrito, ${n} ${n === 1 ? 'producto' : 'productos'}`} className="relative grid size-11 place-items-center rounded-full hover:bg-shell">
        <Bag size={24} />
        {n > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-ink px-1 text-[0.6875rem] font-medium leading-none text-paper tabular" aria-hidden="true">
            {n > 99 ? '99+' : n}
          </span>
        )}
      </Link>
      <AddedPanel />
    </>
  )
}

function AddedPanel() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [item, setItem] = useState<AddedItem | null>(null)
  const [open, setOpen] = useState(false)
  const lines = useCart()
  const { items, loading } = useCartItems(lines, open)
  const n = cartCount(lines)

  useEffect(
    () =>
      onAdded((added) => {
        setItem(added)
        setOpen(true)
        if (!dialog.current?.open) dialog.current?.showModal()
      }),
    [],
  )

  const close = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      aria-labelledby="carrito-agregado"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === dialog.current) close()
      }}
      className="animate-slide-in fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/30 open:flex open:flex-col"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5">
        <h2 id="carrito-agregado" className="font-display text-display-sm">
          Listo, lo sumamos a tu carrito.
        </h2>
        <button type="button" onClick={close} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-shell" aria-label="Cerrar">
          <Close size={20} />
        </button>
      </div>
      {item && (
        <div className="flex gap-4 px-5 py-5">
          <ProductImage image={item.image} alt="" step={item.routineStep} sizes="5rem" className="w-20 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{item.brand}</p>
            <p className="mt-0.5 leading-snug">{item.name}</p>
            <p className="mt-1 text-sm text-ink-soft tabular">
              {item.sizeLabel} · {formatARS(item.chargedCents)}
            </p>
          </div>
        </div>
      )}
      <div className="mt-auto border-t border-line px-5 py-5">
        <p className="flex justify-between text-sm">
          <span>
            Subtotal · {n} {n === 1 ? 'producto' : 'productos'}
          </span>
          <span className="font-medium tabular">{loading ? '…' : formatARS(subtotalCents(lines, items))}</span>
        </p>
        <div className="mt-4 grid gap-2">
          <ButtonLink href="/carrito" onClick={close}>
            Ver mi carrito
          </ButtonLink>
          <button type="button" onClick={close} className={buttonClasses('secondary')}>
            Seguir mirando
          </button>
        </div>
      </div>
    </dialog>
  )
}
