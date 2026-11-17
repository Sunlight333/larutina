'use client'

import { Bag, Plus } from './icons'
import { buttonClasses } from './ui/button'
import { useToast } from './toast'

function message(count: number) {
  return count === 1
    ? 'En la tienda real, esto agrega el producto al carrito.'
    : `En la tienda real, esto agrega los ${count} productos al carrito.`
}

/**
 * The demo has no cart. The button says honestly what the real store would do,
 * which also shows where the "whole routine" ticket-size lever sits.
 */
export function AddToCartButton({
  count = 1,
  label = 'Agregar al carrito',
  className = '',
  size = 'lg',
  variant = 'primary',
}: {
  count?: number
  label?: string
  className?: string
  size?: 'md' | 'lg'
  variant?: 'primary' | 'inverse'
}) {
  const { show } = useToast()
  return (
    <button type="button" onClick={() => show(message(count))} className={buttonClasses(variant, size, className)}>
      <Bag size={20} />
      {label}
    </button>
  )
}

/** Round quick-add button for product cards. */
export function QuickAddButton({ name, className = '' }: { name: string; className?: string }) {
  const { show } = useToast()
  return (
    <button
      type="button"
      aria-label={`Agregar ${name} al carrito`}
      onClick={() => show(message(1))}
      className={`grid size-11 place-items-center rounded-full bg-paper/90 text-ink shadow-[0_8px_24px_-12px_rgb(40_30_20/0.5)] backdrop-blur transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-paper active:scale-95 ${className}`}
    >
      <Plus size={20} />
    </button>
  )
}
