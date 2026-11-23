'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatARS } from '@/lib/money'
import { addToCart } from '@/components/cart/store'
import { Close, Plus } from '@/components/icons'

export type QuickAddProduct = {
  name: string
  brand: string
  routineStep: string
  image: { src: string; width: number; height: number } | null
  variants: { sku: string; sizeLabel: string; priceCents: number; chargedCents: number; available: boolean }[]
}

// NAV-04 / S-17: "Agregar" adds the only size; with several sizes the button
// opens the size selector instead of adding one at random.
export function QuickAdd({ product }: { product: QuickAddProduct }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const sizes = product.variants
  const single = sizes.length === 1 ? sizes[0] : undefined

  const add = (v: QuickAddProduct['variants'][number]) => {
    addToCart({ sku: v.sku, name: product.name, brand: product.brand, sizeLabel: v.sizeLabel, chargedCents: v.chargedCents, image: product.image, routineStep: product.routineStep })
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!sizes.some((v) => v.available)) return null

  const button = 'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line-strong bg-paper text-sm font-medium text-ink transition-colors hover:border-ink'

  if (single) {
    return (
      <button type="button" className={button} onClick={() => add(single)} aria-label={`Agregar ${product.name} al carrito`}>
        <Plus size={16} />
        Agregar
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        className={button}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Elegir tamaño de ${product.name}`}
      >
        Elegir tamaño
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label={`Tamaños de ${product.name}`}
          className="animate-rise absolute inset-x-0 bottom-full z-20 mb-2 rounded-2xl border border-line bg-paper p-2 shadow-[0_18px_50px_-18px_rgb(30_20_10/0.45)]"
        >
          <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
            <p className="text-xs font-medium text-ink-muted">Elegí el tamaño</p>
            <button
              type="button"
              className="grid size-7 place-items-center rounded-full hover:bg-shell"
              aria-label="Cerrar"
              onClick={() => {
                setOpen(false)
                trigger.current?.focus()
              }}
            >
              <Close size={14} />
            </button>
          </div>
          <ul>
            {sizes.map((v) => (
              <li key={v.sku}>
                <button
                  type="button"
                  disabled={!v.available}
                  onClick={() => add(v)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-shell disabled:opacity-50"
                >
                  <span className="font-medium">{v.sizeLabel}</span>
                  <span className="tabular text-ink-soft">
                    {v.available ? (
                      <>
                        {v.chargedCents < v.priceCents && <s className="mr-1.5 text-ink-muted">{formatARS(v.priceCents)}</s>}
                        {formatARS(v.chargedCents)}
                      </>
                    ) : (
                      'Sin stock por ahora'
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
