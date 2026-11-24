'use client'

import { useEffect, useId, type ReactNode, type RefObject } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, Check } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import type { FormState } from '@/lib/form-state'

// The storefront's form pieces, as in the contact form (CMS-03): large
// fields, the label above, the error right under its field and announced.

export const fieldClass =
  'h-13 w-full rounded-2xl border border-line-strong bg-paper px-5 text-base outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_var(--color-shell)] aria-[invalid=true]:border-[oklch(0.55_0.17_25)]'

/** React resets a form after its action; keep what she typed when something needs fixing. */
export function useKeepValues(ref: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const form = ref.current
    if (!form) return
    const keep = (e: Event) => e.preventDefault()
    form.addEventListener('reset', keep)
    return () => form.removeEventListener('reset', keep)
  }, [ref])
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-[oklch(0.5_0.17_25)]">
      {error}
    </p>
  )
}

export function TextField({
  name,
  label,
  error,
  optional,
  help,
  className = '',
  ...input
}: {
  name: string
  label: ReactNode
  error?: string
  optional?: boolean
  help?: ReactNode
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'className'>) {
  const id = useId()
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-medium">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
      </label>
      <input id={id} name={name} aria-invalid={!!error} aria-describedby={describedBy} className={fieldClass} {...input} />
      {help && !error && (
        <p id={`${id}-help`} className="mt-1.5 text-sm text-ink-muted">
          {help}
        </p>
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  )
}

export function TextArea({ name, label, error, optional, ...input }: { name: string; label: ReactNode; error?: string; optional?: boolean } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'className'>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-medium">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
      </label>
      <textarea id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`${fieldClass} h-auto py-3 leading-relaxed`} {...input} />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  )
}

/** A checkbox in the site's style (globals.css), with its text beside it. */
export function CheckField({ name, children, error, defaultChecked }: { name: string; children: ReactNode; error?: string; defaultChecked?: boolean }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-snug">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="mt-0.5 shrink-0" />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  )
}

/** The form's own message: an alert when something failed, a quiet confirmation when it worked. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null
  return state.ok ? (
    <p role="status" className="flex items-start gap-2.5 rounded-2xl bg-sage-soft px-4 py-3 text-[0.9375rem] text-sage-ink">
      <Check size={18} className="mt-0.5 shrink-0" />
      {state.message}
    </p>
  ) : (
    <p role="alert" className="flex items-start gap-2.5 rounded-2xl bg-[oklch(0.95_0.03_25)] px-4 py-3 text-[0.9375rem] text-[oklch(0.45_0.15_25)]">
      <Alert size={18} className="mt-0.5 shrink-0" />
      {state.message}
    </p>
  )
}

export function Submit({
  children,
  variant = 'primary',
  size = 'lg',
  className = '',
  pendingLabel,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  className?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant, size, `disabled:!opacity-60 ${className}`)}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
