'use client'

import { useActionState, useState } from 'react'
import { Check } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { Copy, Upload } from '@/components/checkout/icons'
import { errorText, fieldClass } from '@/components/checkout/ui'
import type { OrderFormState } from '@/app/(site)/pedido/[number]/actions'

type Action = (prev: OrderFormState, form: FormData) => Promise<OrderFormState>

/** CF-03: "Copiar alias". */
export function CopyAlias({ alias }: { alias: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(alias)
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        } catch {
          // Clipboard blocked: the alias is on screen to copy by hand.
        }
      }}
      className={buttonClasses(copied ? 'secondary' : 'primary', 'sm', 'shrink-0')}
      aria-live="polite"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Copiado' : 'Copiar alias'}
    </button>
  )
}

/** The transfer receipt (CK-08): an image or a PDF, to a private file. */
export function ReceiptUpload({ action, number, token, accept }: { action: Action; number: string; token: string; accept: string }) {
  const [state, formAction, pending] = useActionState(action, null)
  const [file, setFile] = useState<string | null>(null)
  if (state?.ok) {
    return (
      <p role="status" className="flex items-center gap-3 rounded-[1.25rem_2rem_1.25rem_2rem] bg-sage-soft px-5 py-4 font-semibold text-sage-ink">
        <Check size={20} />
        {state.message}
      </p>
    )
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="t" value={token} />
      <div className="relative flex min-h-16 items-center gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] border border-dashed border-line-strong bg-paper p-2.5 pr-5 transition-colors focus-within:border-ink focus-within:shadow-[0_0_0_4px_var(--color-shell)] hover:border-ink-muted">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_8px_18px_-10px_rgb(40_30_20/0.45)]">
          <Upload size={22} />
        </span>
        <span className="min-w-0 text-[0.9375rem]">
          <span className="block font-semibold">{file ?? 'Elegir el comprobante'}</span>
          <span className="block truncate text-sm text-ink-muted">Imagen o PDF, hasta 10 MB</span>
        </span>
        <input name="receipt" type="file" accept={accept} required onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Comprobante de la transferencia" />
      </div>
      {state && !state.ok && (
        <p className={errorText} role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending || !file} className={buttonClasses('primary', 'md')}>
        <Upload size={18} />
        {pending ? 'Enviando…' : 'Enviar comprobante'}
      </button>
    </form>
  )
}

/** CF-04: only a password. */
export function CreateAccount({ action, number, token }: { action: Action; number: string; token: string }) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="t" value={token} />
      <div className="min-w-0 flex-1">
        <label htmlFor="cf-password" className="sr-only">
          Contraseña
        </label>
        <input
          id="cf-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Contraseña"
          minLength={8}
          maxLength={200}
          required
          aria-invalid={(state && !state.ok) || undefined}
          aria-describedby={state && !state.ok ? 'cf-password-error' : undefined}
          className={fieldClass}
        />
        {state && !state.ok && (
          <p id="cf-password-error" className={`mt-1.5 ${errorText}`} role="alert">
            {state.message}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className={buttonClasses('primary', 'md', 'h-13')}>
        {pending ? '…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
