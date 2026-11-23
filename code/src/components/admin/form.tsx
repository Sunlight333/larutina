'use client'

import { createContext, useActionState, useContext, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { adminButton } from './ui'
import type { FormState } from '@/server/admin/forms'

// A server-action form that shows the result and per-field errors. Fields read
// their error from context, so a screen only lists its fields.

const ErrorsCtx = createContext<Record<string, string>>({})
export const useFieldError = (name: string) => useContext(ErrorsCtx)[name]

export function AdminForm({
  action,
  children,
  className = 'space-y-5',
  submitLabel = 'Guardar',
  extraButtons,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  children: ReactNode
  className?: string
  submitLabel?: string | null
  extraButtons?: ReactNode
  resetOnSuccess?: boolean
}) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className={className} key={resetOnSuccess && state?.ok ? state.at : undefined}>
      <ErrorsCtx.Provider value={state?.fieldErrors ?? {}}>
        {state?.message && (
          <div role={state.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-sm ${state.ok ? 'bg-sage-soft text-sage-ink' : 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.15_25)]'}`}>
            {state.message}
          </div>
        )}
        {children}
        {(submitLabel || extraButtons) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {submitLabel && <SubmitButton>{submitLabel}</SubmitButton>}
            {extraButtons}
          </div>
        )}
      </ErrorsCtx.Provider>
    </form>
  )
}

/** A submit button; with `name`/`value` it tells the action which button was pressed. */
export function SubmitButton({ children, variant = 'primary', name, value, confirm }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; name?: string; value?: string; confirm?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={adminButton(variant)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {pending ? 'Guardando…' : children}
    </button>
  )
}
