'use client'

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Plus } from '@/components/icons'
import type { ContactState } from '@/app/(site)/contacto/actions'
import { Select } from '@/components/ui/select'

// CMS-03, AY-03: reason, contact details, message and up to four photos.
// Errors are announced and shown next to each field; what was typed stays
// when something needs fixing.

const field = 'h-13 w-full rounded-2xl border border-line-strong bg-paper px-5 text-base outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_var(--color-shell)] aria-[invalid=true]:border-[oklch(0.55_0.17_25)]'

export function ContactForm({
  action,
  reasons,
  maxPhotos,
  confirmation,
  privacy,
}: {
  action: (prev: ContactState, form: FormData) => Promise<ContactState>
  reasons: readonly string[]
  maxPhotos: number
  confirmation: ReactNode
  privacy: ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  const errors = state?.fieldErrors ?? {}
  const [photos, setPhotos] = useState<string[]>([])

  // React resets a form after its action; keep the fields when there is something to fix.
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    const keep = (e: Event) => e.preventDefault()
    form.addEventListener('reset', keep)
    return () => form.removeEventListener('reset', keep)
  }, [])

  if (state?.ok) {
    return (
      <div role="status" className="rounded-[var(--radius-card)] bg-sage-soft p-6 text-sage-ink">
        <p className="font-display text-display-sm">{state.message}</p>
        <div className="mt-2">{confirmation}</div>
      </div>
    )
  }

  const describedBy = (name: string, help?: boolean) => (errors[name] ? `${id}-${name}-error` : help ? `${id}-${name}-help` : undefined)
  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="mt-1.5 text-sm font-medium text-[oklch(0.5_0.17_25)]">
        {errors[name]}
      </p>
    ) : null
  const Label = ({ name, children, optional }: { name: string; children: ReactNode; optional?: boolean }) => (
    <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-sm font-medium">
      {children}
      {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
    </label>
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-[oklch(0.95_0.03_25)] px-4 py-3 text-sm text-[oklch(0.45_0.15_25)]">
          {state.message}
        </p>
      )}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <Label name="reason">Motivo</Label>
        <Select
          id={`${id}-reason`}
          name="reason"
          options={reasons.map((r) => ({ value: r, label: r }))}
          invalid={!!errors.reason}
          describedBy={describedBy('reason')}
        />
        <FieldError name="reason" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label name="name">Nombre</Label>
          <input id={`${id}-name`} name="name" required autoComplete="name" maxLength={120} aria-invalid={!!errors.name} aria-describedby={describedBy('name')} className={field} />
          <FieldError name="name" />
        </div>
        <div>
          <Label name="email">Email</Label>
          <input id={`${id}-email`} name="email" type="email" required autoComplete="email" maxLength={200} aria-invalid={!!errors.email} aria-describedby={describedBy('email')} className={field} />
          <FieldError name="email" />
        </div>
        <div>
          <Label name="phone" optional>
            Teléfono
          </Label>
          <input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={25} aria-invalid={!!errors.phone} aria-describedby={describedBy('phone')} className={field} />
          <FieldError name="phone" />
        </div>
        <div>
          <Label name="orderNumber" optional>
            N° de pedido
          </Label>
          <input id={`${id}-orderNumber`} name="orderNumber" maxLength={40} aria-invalid={!!errors.orderNumber} aria-describedby={describedBy('orderNumber', true)} className={field} />
          <p id={`${id}-orderNumber-help`} className="mt-1.5 text-sm text-ink-muted">
            Si es por un pedido.
          </p>
          <FieldError name="orderNumber" />
        </div>
      </div>
      <div>
        <Label name="message">Mensaje</Label>
        <textarea id={`${id}-message`} name="message" required rows={6} maxLength={4000} aria-invalid={!!errors.message} aria-describedby={describedBy('message')} className={`${field} h-auto py-3 leading-relaxed`} />
        <FieldError name="message" />
      </div>
      <div>
        <Label name="photos" optional>
          Fotos
        </Label>
        {/* The site's own file picker: the real input sits invisibly over a panel that names what was chosen. */}
        <div className="relative flex min-h-16 items-center gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] border border-dashed border-line-strong bg-shell/60 p-2.5 pr-5 transition-colors focus-within:border-ink focus-within:shadow-[0_0_0_4px_var(--color-shell)] hover:border-ink-muted">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_8px_18px_-10px_rgb(40_30_20/0.45)]">
            <Plus size={22} />
          </span>
          <span className="min-w-0 text-[0.9375rem]">
            <span className="block font-semibold">{photos.length ? `${photos.length} ${photos.length === 1 ? 'foto elegida' : 'fotos elegidas'}` : 'Elegir fotos'}</span>
            <span className="block truncate text-sm text-ink-muted">{photos.length ? photos.join(', ') : 'Tocá para sumar imágenes desde tu equipo'}</span>
          </span>
          <input
            id={`${id}-photos`}
            name="photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-invalid={!!errors.photos}
            aria-describedby={describedBy('photos', true)}
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).map((f) => f.name))}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <p id={`${id}-photos-help`} className="mt-1.5 text-sm text-ink-muted">
          Si te llegó un producto dañado o distinto, sumá hasta {maxPhotos} fotos (JPG, PNG o WebP, hasta 10 MB cada una).
        </p>
        <FieldError name="photos" />
      </div>
      <div className="text-sm text-ink-muted">{privacy}</div>
      <button type="submit" disabled={pending} className="h-14 rounded-full bg-ink px-9 font-semibold text-paper shadow-[var(--shadow-lift)] transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-ink-soft disabled:opacity-60">
        {pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}
