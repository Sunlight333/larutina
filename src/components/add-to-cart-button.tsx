'use client'

import { buttonClasses } from './ui/button'
import { useToast } from './toast'

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
  const message =
    count === 1
      ? 'En la tienda real, esto agrega el producto al carrito.'
      : `En la tienda real, esto agrega los ${count} productos al carrito.`
  return (
    <button type="button" onClick={() => show(message)} className={buttonClasses(variant, size, className)}>
      {label}
    </button>
  )
}
