import Link from 'next/link'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse'
type Size = 'md' | 'lg' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200 select-none active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft shadow-[0_1px_0_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(40_30_20/0.45)]',
  secondary: 'border border-line-strong bg-paper text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-shell',
  inverse: 'bg-paper text-ink hover:bg-sand',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-12 px-6 text-[0.9375rem]',
  lg: 'h-14 px-8 text-base',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

export function ButtonLink({
  variant,
  size,
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}
