'use client'

// The Phase 1 cart: SKUs and quantities in this browser's localStorage.
// Prices are never stored here; the cart page re-reads them from the server
// (/api/cart). Phase 2 moves the cart to the server with checkout.
import { useSyncExternalStore } from 'react'

export type CartLine = { sku: string; qty: number }

/** What the "added" panel shows right away, before the server answers. */
export type AddedItem = { sku: string; name: string; brand: string; sizeLabel: string; chargedCents: number; image: { src: string; width: number; height: number } | null; routineStep: string }

const KEY = 'lr_cart_v1'
export const MAX_QTY = 10
const MAX_LINES = 50
const EMPTY: CartLine[] = []

let lines: CartLine[] | null = null
const listeners = new Set<() => void>()
const addedListeners = new Set<(item: AddedItem) => void>()

function valid(x: unknown): x is CartLine {
  const l = x as CartLine
  return !!l && typeof l.sku === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(l.sku) && Number.isInteger(l.qty) && l.qty > 0
}

function read(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(valid).map((l) => ({ sku: l.sku, qty: Math.min(l.qty, MAX_QTY) })).slice(0, MAX_LINES) : EMPTY
  } catch {
    return EMPTY
  }
}

function write(next: CartLine[]) {
  lines = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or full storage: the cart still works for this page view.
  }
  listeners.forEach((l) => l())
}

function current(): CartLine[] {
  if (lines === null) lines = typeof window === 'undefined' ? EMPTY : read()
  return lines
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the cart.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      lines = read()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, current, () => EMPTY)
}

export function cartCount(l: CartLine[]): number {
  return l.reduce((n, x) => n + x.qty, 0)
}

export function addToCart(item: AddedItem, qty = 1) {
  const now = current()
  const existing = now.find((l) => l.sku === item.sku)
  const next = existing
    ? now.map((l) => (l.sku === item.sku ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
    : [...now, { sku: item.sku, qty: Math.min(MAX_QTY, qty) }].slice(-MAX_LINES)
  write(next)
  addedListeners.forEach((l) => l(item))
}

export function setQty(sku: string, qty: number) {
  if (qty <= 0) return removeFromCart(sku)
  write(current().map((l) => (l.sku === sku ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) } : l)))
}

export function removeFromCart(sku: string) {
  write(current().filter((l) => l.sku !== sku))
}

export function onAdded(listener: (item: AddedItem) => void) {
  addedListeners.add(listener)
  return () => {
    addedListeners.delete(listener)
  }
}
