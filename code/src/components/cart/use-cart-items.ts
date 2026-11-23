'use client'

import { useEffect, useState } from 'react'
import type { CartItem } from '@/server/services/catalog/cart'
import type { CartLine } from './store'

export type CartItemsState = { items: Map<string, CartItem>; loading: boolean; error: boolean }

/** Current prices for the SKUs in the cart, re-read from the server whenever the set of SKUs changes. */
export function useCartItems(lines: CartLine[], enabled = true): CartItemsState {
  const key = [...new Set(lines.map((l) => l.sku))].sort().join(',')
  const [state, setState] = useState<CartItemsState>({ items: new Map(), loading: !!key, error: false })

  useEffect(() => {
    if (!enabled) return
    if (!key) {
      setState({ items: new Map(), loading: false, error: false })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: false }))
    const q = new URLSearchParams(key.split(',').map((sku) => ['sku', sku]))
    fetch(`/api/cart?${q}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { items: CartItem[] }) => setState({ items: new Map(data.items.map((i) => [i.sku, i])), loading: false, error: false }))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: true }))
      })
    return () => ctrl.abort()
  }, [key, enabled])

  return state
}

export function subtotalCents(lines: CartLine[], items: Map<string, CartItem>): number {
  return lines.reduce((sum, l) => {
    const it = items.get(l.sku)
    return it?.available ? sum + it.chargedCents * Math.min(l.qty, it.maxQty) : sum
  }, 0)
}
