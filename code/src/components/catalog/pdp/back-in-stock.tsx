'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Check, Mail } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { backInStockAction } from '@/app/(site)/producto/actions'
import { FieldError, fieldClass, Submit } from '@/components/account/fields'

// G-13: on a size that ran out, 'Avisame cuando vuelva' asks for an email;
// the notice goes out once, when stock comes back (NAV-07, EM-12).
export function BackInStock({ sku, email = '' }: { sku: string; email?: string }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(backInStockAction, null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  if (state?.ok) {
    return (
      <p role="status" className="animate-pop mt-4 flex items-center gap-3 rounded-[1.25rem_2rem_1.25rem_2rem] bg-sage-soft px-4 py-3.5 text-[1rem] font-medium text-sage-ink">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper/70">
          <Check size={18} />
        </span>
        {state.message}
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses('secondary', 'lg', 'mt-4 w-full')}>
        <Mail size={20} /> Avisame cuando vuelva
      </button>
    )
  }
  const error = state?.errors?.email ?? (state && !state.ok ? state.message : undefined)
  return (
    <form action={action} className="animate-pop tex-linen mt-4 rounded-[1.25rem_2rem_1.25rem_2rem] bg-shell p-4 sm:p-5" noValidate>
      <input type="hidden" name="sku" value={sku} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label htmlFor={`aviso-${sku}`} className="mb-1.5 block text-[0.9375rem] font-medium">
        Email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={input}
          id={`aviso-${sku}`}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={200}
          defaultValue={email}
          aria-invalid={!!error}
          aria-describedby={error ? `aviso-${sku}-error` : undefined}
          className={`${fieldClass} !h-14 sm:flex-1`}
        />
        <Submit size="lg" className="shrink-0" pendingLabel="Enviando…">
          Avisame cuando vuelva
        </Submit>
      </div>
      <FieldError id={`aviso-${sku}-error`} error={error} />
    </form>
  )
}
