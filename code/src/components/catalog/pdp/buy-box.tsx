'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatARS } from '@/lib/money'
import { addToCart, MAX_QTY } from '@/components/cart/store'
import type { BuyVariant } from '@/server/services/catalog/product'

type Props = {
  product: { name: string; brand: string; routineStep: string; image: { src: string; width: number; height: number } | null }
  variants: BuyVariant[]
  presale: string | null
  /** False for drafts the team is previewing: they cannot be bought yet. */
  published: boolean
}

// F-07 and PDP-02: size selector with its price, unit price and price
// without national taxes (both on the charged price), duration per size
// (CAT-09), quantity and "Agregar al carrito". F-25: on phones a bar with
// the price and the button stays at the bottom once the main button scrolls
// out of view.
export function BuyBox({ product, variants, presale, published }: Props) {
  const firstAvailable = variants.findIndex((v) => v.available)
  const [selected, setSelected] = useState(firstAvailable >= 0 ? firstAvailable : 0)
  const [qty, setQty] = useState(1)
  const [showBar, setShowBar] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const groupId = useId()
  const v = variants[selected]

  useEffect(() => {
    const el = button.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setShowBar(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!v) return null
  const promo = v.chargedCents < v.priceCents
  const maxQty = MAX_QTY
  const add = () => {
    if (!v.available) return
    addToCart({ sku: v.sku, name: product.name, brand: product.brand, sizeLabel: v.sizeLabel, chargedCents: v.chargedCents, image: product.image, routineStep: product.routineStep }, qty)
  }
  const label = !published ? 'Todavía no está a la venta' : v.available ? 'Agregar al carrito' : 'Sin stock por ahora'

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6">
      <p className="flex flex-wrap items-baseline gap-x-3 tabular" aria-live="polite">
        <span className={`text-[1.75rem] font-medium leading-none ${promo ? 'text-accent-ink' : ''}`}>
          {promo && <span className="sr-only">Precio promocional: </span>}
          {formatARS(v.chargedCents)}
        </span>
        {promo && (
          <s className="text-base text-ink-muted">
            <span className="sr-only">Precio anterior: </span>
            {formatARS(v.priceCents)}
          </s>
        )}
      </p>
      <dl className="mt-2 space-y-0.5 text-[0.8125rem] text-ink-muted tabular">
        {v.unitPrice && (
          <div className="flex gap-1">
            <dt>Precio por {v.unitPrice.per}:</dt>
            <dd>{formatARS(v.unitPrice.cents)}</dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt>Precio sin impuestos nacionales:</dt>
          <dd>{formatARS(v.withoutTaxesCents)}</dd>
        </div>
      </dl>

      {variants.length > 1 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Tamaño</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((x, i) => (
              <label
                key={x.sku}
                className={`relative flex min-w-[6.5rem] cursor-pointer flex-col rounded-2xl border px-4 py-2.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                  i === selected ? 'border-ink bg-shell' : 'border-line-strong hover:border-ink'
                }`}
              >
                <input type="radio" name={`size-${groupId}`} value={x.sku} checked={i === selected} onChange={() => setSelected(i)} className="sr-only" />
                <span className="font-medium">{x.sizeLabel}</span>
                <span className="tabular text-ink-soft">{x.available ? formatARS(x.chargedCents) : 'Sin stock por ahora'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {v.durationDays && <p className="mt-4 text-sm text-ink-soft">{variants.length > 1 ? `El de ${v.sizeLabel} rinde` : 'Rinde'} unos {v.durationDays} días con uso normal.</p>}
      {presale && <p className="mt-4 text-sm font-medium text-sage-ink">{presale}</p>}

      <div className="mt-5 flex gap-3">
        {published && v.available && (
          <div className="flex h-12 items-center rounded-full border border-line-strong" role="group" aria-label="Cantidad">
            <button type="button" className="grid size-12 place-items-center rounded-full text-lg hover:bg-shell disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Restar uno">
              −
            </button>
            <span className="w-6 text-center tabular" aria-live="polite" aria-label={`Cantidad: ${qty}`}>
              {qty}
            </span>
            <button type="button" className="grid size-12 place-items-center rounded-full text-lg hover:bg-shell disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Sumar uno">
              +
            </button>
          </div>
        )}
        <button
          ref={button}
          type="button"
          onClick={add}
          disabled={!published || !v.available}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper shadow-[0_8px_24px_-12px_rgb(40_30_20/0.45)] transition-colors hover:bg-ink-soft disabled:bg-line-strong disabled:text-ink-soft disabled:shadow-none"
        >
          {label}
        </button>
      </div>

      {showBar && published && (
        <div className="animate-fade fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{product.name}</p>
              <p className="text-sm font-medium tabular">
                {formatARS(v.chargedCents)} <span className="font-normal text-ink-muted">· {v.sizeLabel}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!v.available}
              className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper disabled:bg-line-strong disabled:text-ink-soft"
            >
              {v.available ? 'Agregar al carrito' : 'Sin stock por ahora'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
