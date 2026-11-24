'use client'

import { useActionState } from 'react'
import { ArrowRight } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { errorText, fieldClass } from '@/components/checkout/ui'
import type { LookupState } from '@/app/(site)/seguir-mi-pedido/actions'

// CU-20: "Número de pedido · Email de la compra — Ver estado".
export function LookupForm({ action, number }: { action: (prev: LookupState, form: FormData) => Promise<LookupState>; number: string }) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="cu-number" className="mb-1.5 block text-[0.9375rem] font-semibold">
          Número de pedido
        </label>
        <input id="cu-number" name="number" defaultValue={state?.number ?? number} required maxLength={30} autoComplete="off" placeholder="LR-000123" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="cu-email" className="mb-1.5 block text-[0.9375rem] font-semibold">
          Email de la compra
        </label>
        <input id="cu-email" name="email" type="email" defaultValue={state?.email ?? ''} required maxLength={120} autoComplete="email" aria-invalid={!!state?.error || undefined} aria-describedby={state?.error ? 'cu-error' : undefined} className={fieldClass} />
      </div>
      {state?.error && (
        <p id="cu-error" role="alert" className={errorText}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
        {pending ? '…' : 'Ver estado'}
        <ArrowRight size={20} />
      </button>
    </form>
  )
}
