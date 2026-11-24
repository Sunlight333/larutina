'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { Check, IconBadge } from '@/components/icons'
import { Select } from '@/components/ui/select'
import { submitReviewAction } from '@/app/(site)/resenas/[number]/actions'
import { FieldError, FormMessage, Submit, TextArea, TextField, useKeepValues } from './fields'

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z'

/** The stars as the site draws them: five radios underneath, so arrows and screen readers work as in any choice. */
function StarInput({ error }: { error?: string }) {
  const [value, setValue] = useState(0)
  const [hover, setHover] = useState(0)
  const id = useId()
  const shown = hover || value
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-[0.9375rem] font-medium">Estrellas</legend>
      <div className="flex items-center gap-1" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-full p-1 transition-transform duration-200 hover:scale-110 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink" onPointerEnter={() => setHover(n)}>
            <input type="radio" name="rating" value={n} checked={value === n} onChange={() => setValue(n)} className="sr-only" />
            <span className="sr-only">{n === 1 ? '1 estrella' : `${n} estrellas`}</span>
            <svg viewBox="0 0 24 24" className="size-10 sm:size-11" aria-hidden="true">
              <path d={STAR} fill={n <= shown ? 'var(--color-accent)' : 'var(--color-paper)'} stroke={n <= shown ? 'var(--color-accent-ink)' : 'var(--color-line-strong)'} strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  )
}

export function ReviewForm({ number, token, line, usageTimes }: { number: string; token: string; line: string; usageTimes: readonly string[] }) {
  const [state, action] = useActionState(submitReviewAction, null)
  const ref = useRef<HTMLFormElement>(null)
  const usageId = useId()
  useKeepValues(ref)
  if (state?.ok) {
    return (
      <p role="status" className="flex items-center gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] bg-sage-soft p-5 text-[1rem] font-medium text-sage-ink">
        <IconBadge size="sm" tone="sage">
          <Check size={20} />
        </IconBadge>
        {state.message}
      </p>
    )
  }
  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="line" value={line} />
      <FormMessage state={state} />
      <StarInput error={e.rating} />
      <div>
        <p id={usageId} className="mb-1.5 text-[0.9375rem] font-medium">
          Hace cuánto lo usás <span className="font-normal text-ink-muted">(opcional)</span>
        </p>
        <Select name="usageTime" labelledBy={usageId} options={usageTimes.map((u) => ({ value: u, label: u }))} />
      </div>
      <TextField name="title" label="Título" optional maxLength={120} />
      <TextArea name="body" label="Contanos cómo te fue" rows={5} maxLength={3000} error={e.body} />
      <Submit size="md" pendingLabel="Enviando…">
        Enviar
      </Submit>
    </form>
  )
}
