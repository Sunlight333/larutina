'use client'

// The cart in the browser: a view of the server cart (CMP-01), kept in one
// store for the header count, the "added" panel and the cart page. Every
// change goes to /api/cart and the store takes the cart the server answers
// with, so prices, discounts and stock are always the server's. A cart left in
// localStorage by Phase 1 is sent to the server once and then forgotten.
import { useSyncExternalStore } from 'react'
import type { ItemSource } from '@prisma/client'
import type { ShopCart } from '@/server/commerce/cart-access'
import type { CartApiBody } from '@/server/commerce/cart-cookie'

/** What the "added" panel shows right away, before the server answers. */
export type AddedItem = { sku: string; name: string; brand: string; sizeLabel: string; chargedCents: number; image: { src: string; width: number; height: number } | null; routineStep: string }

export const MAX_QTY = 10
const LEGACY_KEY = 'lr_cart_v1'

export type CartState = {
  cart: ShopCart | null
  /** A request is on its way. */
  busy: boolean
  /** The last request could not reach the server. */
  failed: boolean
  /** BO-11 notices: kept until the next change she makes. */
  notices: string[]
}

let state: CartState = { cart: null, busy: false, failed: false, notices: [] }
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const addedListeners = new Set<(item: AddedItem) => void>()
const resultListeners = new Set<(r: { message?: string; error?: string }) => void>()

function set(patch: Partial<CartState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void loadCart()
  return () => {
    listeners.delete(listener)
  }
}

const SERVER: CartState = { cart: null, busy: false, failed: false, notices: [] }

export function useCartState(): CartState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  )
}

/** The number in the header (G-03). */
export function useCartCount(): number {
  return useCartState().cart?.count ?? 0
}

async function call(path: string, init?: RequestInit): Promise<(CartApiBody & { error?: string }) | null> {
  set({ busy: true })
  try {
    const res = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
    const body = (await res.json().catch(() => null)) as (Partial<CartApiBody> & { error?: string }) | null
    if (!body?.cart) {
      set({ busy: false, failed: !res.ok && res.status !== 429 })
      return body?.error && state.cart ? { cart: state.cart, error: body.error } : null
    }
    set({ cart: body.cart, busy: false, failed: false, ...(body.cart.notices.length ? { notices: body.cart.notices } : {}) })
    return body as CartApiBody
  } catch {
    set({ busy: false, failed: true })
    return null
  }
}

function readLegacy(): unknown[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

/** Loads the cart once per page view; the first time, it brings the Phase 1 cart over. */
export function loadCart(force = false): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (loading && !force) return loading
  const legacy = readLegacy()
  loading = legacy.length
    ? call('/api/cart/import', { method: 'POST', body: JSON.stringify({ lines: legacy }) }).then((r) => {
        if (!r?.cart) return
        try {
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          // Storage blocked: the import is harmless to repeat.
        }
      })
    : call('/api/cart').then(() => {})
  return loading
}

/** CMP-01: where the button was, for attribution. */
function sourceHere(): { source: ItemSource; sourceRef: string } {
  const p = window.location.pathname
  const ref = (p + (p.startsWith('/buscar') ? window.location.search : '')).slice(0, 200)
  if (p.startsWith('/producto/')) return { source: 'PDP', sourceRef: ref }
  if (p.startsWith('/buscar')) return { source: 'SEARCH', sourceRef: ref }
  if (p.startsWith('/rutina')) return { source: 'ROUTINE', sourceRef: ref }
  if (p.startsWith('/diagnostico')) return { source: 'DIAGNOSIS', sourceRef: ref }
  if (/^\/(productos|categoria|necesidad|necesidades|marca|marcas|ingrediente)(\/|$)/.test(p)) return { source: 'LISTING', sourceRef: ref }
  return { source: 'OTHER', sourceRef: ref }
}

/** "Agregar al carrito": the panel opens at once (G-07); the server confirms or says why not. */
export async function addToCart(item: AddedItem, qty = 1, source?: ItemSource) {
  set({ notices: [] })
  addedListeners.forEach((l) => l(item))
  const here = sourceHere()
  const r = await call('/api/cart/items', { method: 'POST', body: JSON.stringify({ sku: item.sku, quantity: qty, source: source ?? here.source, sourceRef: here.sourceRef }) })
  const result = r ? { message: r.message, error: r.error } : { error: 'No pudimos sumar el producto. Revisá tu conexión y probá de nuevo.' }
  resultListeners.forEach((l) => l(result))
}

export async function setLineQty(lineId: string, quantity: number) {
  set({ notices: [] })
  await call(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
}

export async function removeLine(lineId: string) {
  set({ notices: [] })
  await call(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: 'DELETE' })
}

export function applyCode(code: string) {
  return call('/api/cart/code', { method: 'POST', body: JSON.stringify({ code }) })
}

export function removeCode() {
  return call('/api/cart/code', { method: 'DELETE' })
}

/** The checkout found the cart changed (BO-11, CK-18): show the new cart and why. */
export function takeCart(cart: ShopCart, notices: string[] = []) {
  set({ cart, notices })
}

export function onAdded(listener: (item: AddedItem) => void) {
  addedListeners.add(listener)
  return () => {
    addedListeners.delete(listener)
  }
}

export function onAddResult(listener: (r: { message?: string; error?: string }) => void) {
  resultListeners.add(listener)
  return () => {
    resultListeners.delete(listener)
  }
}
