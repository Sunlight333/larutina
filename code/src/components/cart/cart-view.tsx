'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Chat, Info } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { useToast } from '@/components/toast'
import { formatARS } from '@/lib/money'
import { cartCount, removeFromCart, setQty, useCart } from './store'
import { subtotalCents, useCartItems } from './use-cart-items'

// /carrito (BO-01, BO-02, BO-09 to BO-13), minimal until checkout arrives in
// Phase 2: items with quantity and "Eliminar", the subtotal on prices
// re-read from the server, and checkout shown but not yet active.
export function CartView({ whatsapp, paymentLine }: { whatsapp: string | null; paymentLine: string | null }) {
  const lines = useCart()
  const { items, loading, error } = useCartItems(lines)
  const toast = useToast()
  const n = cartCount(lines)
  const subtotal = subtotalCents(lines, items)
  const announced = useRef(new Set<string>())

  // BO-11: a size that ran out or a quantity above the stock is fixed, and said.
  useEffect(() => {
    if (loading || error) return
    for (const l of lines) {
      const it = items.get(l.sku)
      if (!it || announced.current.has(l.sku)) continue
      if (!it.available) {
        announced.current.add(l.sku)
        removeFromCart(l.sku)
        toast.show(`${it.name} se quedó sin stock y lo sacamos de tu carrito.`)
      } else if (l.qty > it.maxQty) {
        announced.current.add(l.sku)
        setQty(l.sku, it.maxQty)
        toast.show(`Quedan ${it.maxQty} unidades de ${it.name}.`)
      }
    }
  }, [lines, items, loading, error, toast])

  if (!lines.length) {
    return (
      <div className="rounded-[var(--radius-card)] bg-shell px-6 py-14 text-center">
        <p className="text-lede">Tu carrito está vacío.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/productos">Ver productos</ButtonLink>
          <ButtonLink href="/diagnostico" variant="secondary">
            Hacer mi diagnóstico
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <p className="text-sm text-ink-soft">
          {n} {n === 1 ? 'producto' : 'productos'}
        </p>
        {error && (
          <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm" role="alert">
            No pudimos cargar los precios. Revisá tu conexión y recargá la página.
          </p>
        )}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {lines.map((l) => {
            const it = items.get(l.sku)
            if (!it) {
              return (
                <li key={l.sku} className="flex items-center justify-between gap-4 py-5 text-sm text-ink-muted">
                  {loading ? <span>Cargando…</span> : <span>Este producto ya no está disponible.</span>}
                  {!loading && (
                    <button type="button" className="underline underline-offset-2" onClick={() => removeFromCart(l.sku)}>
                      Eliminar
                    </button>
                  )}
                </li>
              )
            }
            const promo = it.chargedCents < it.priceCents
            return (
              <li key={l.sku} className="flex gap-4 py-5">
                <Link href={`/producto/${it.productCode}`} className="w-20 shrink-0 sm:w-24" tabIndex={-1} aria-hidden="true">
                  <ProductImage image={it.image} alt="" step={it.routineStep} sizes="6rem" className="rounded-lg" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-ink-muted">{it.brand}</p>
                    <Link href={`/producto/${it.productCode}`} className="mt-0.5 block leading-snug hover:underline hover:underline-offset-2">
                      {it.name}
                    </Link>
                    <p className="mt-1 text-sm text-ink-soft">
                      {it.sizeLabel} · {it.stepLabel} · {it.momentLabel.toLocaleLowerCase('es-AR')}
                    </p>
                    {it.presale && <p className="mt-1 text-xs font-medium text-sage-ink">{it.presale}</p>}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex h-10 items-center rounded-full border border-line-strong" role="group" aria-label={`Cantidad de ${it.name}`}>
                        <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-shell disabled:opacity-40" onClick={() => setQty(l.sku, l.qty - 1)} disabled={l.qty <= 1} aria-label="Restar uno">
                          −
                        </button>
                        <span className="w-6 text-center text-sm tabular" aria-live="polite">
                          {l.qty}
                        </span>
                        <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-shell disabled:opacity-40" onClick={() => setQty(l.sku, l.qty + 1)} disabled={l.qty >= it.maxQty} aria-label="Sumar uno">
                          +
                        </button>
                      </div>
                      <button type="button" className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink" onClick={() => removeFromCart(l.sku)} aria-label={`Eliminar ${it.name}`}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p className="tabular sm:text-right">
                    <span className="font-medium">{formatARS(it.chargedCents * l.qty)}</span>
                    {promo && (
                      <s className="block text-sm text-ink-muted">
                        <span className="sr-only">Precio anterior: </span>
                        {formatARS(it.priceCents * l.qty)}
                      </s>
                    )}
                    {l.qty > 1 && <span className="block text-xs text-ink-muted">{formatARS(it.chargedCents)} c/u</span>}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] bg-shell p-6 lg:sticky lg:top-24" aria-label="Resumen">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-medium tabular">{loading ? '…' : formatARS(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-ink-soft">
            <dt>Envío</dt>
            <dd>Se calcula en el siguiente paso</dd>
          </div>
        </dl>
        <button type="button" disabled className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-[0.9375rem] font-medium text-paper disabled:opacity-40" aria-describedby="pago-pronto">
          Continuar compra
        </button>
        <p id="pago-pronto" className="mt-3 flex gap-2 text-sm text-ink-soft">
          <Info size={16} className="mt-0.5 shrink-0" />
          El pago se habilita con la apertura de la tienda. Tu carrito queda guardado en este dispositivo.
        </p>
        {paymentLine && <p className="mt-3 text-xs text-ink-muted">{paymentLine}</p>}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
            <Chat size={18} />
            ¿Dudas antes de comprar? Escribinos
          </a>
        )}
      </aside>
    </div>
  )
}
