'use client'

import { useActionState, useId } from 'react'
import type { SignupState } from '@/app/(site)/actions'

// One form for the waitlist and the newsletter: email, required consent, a
// honeypot field, and the result announced to screen readers.
export function SignupForm({
  action,
  consent,
  button,
  source,
  inverse = false,
}: {
  action: (prev: SignupState, form: FormData) => Promise<SignupState>
  consent: string
  button: string
  source?: string
  inverse?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const id = useId()
  if (state?.ok) {
    return (
      <p role="status" className="text-base">
        {state.message}
      </p>
    )
  }
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {source && <input type="hidden" name="source" value={source} />}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className={`h-12 min-w-0 flex-1 rounded-full border px-5 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent ${inverse ? 'border-paper/30 bg-transparent text-paper placeholder:text-paper/50' : 'border-line-strong bg-paper'}`}
        />
        <button type="submit" disabled={pending} className={`h-12 rounded-full px-6 font-medium ${inverse ? 'bg-paper text-ink' : 'bg-ink text-paper'} disabled:opacity-60`}>
          {pending ? 'Enviando…' : button}
        </button>
      </div>
      <label className="flex items-start gap-2 text-[0.8125rem] leading-snug opacity-80">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-current" />
        <span>{consent}</span>
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-medium">
          {state.message}
        </p>
      )}
    </form>
  )
}
