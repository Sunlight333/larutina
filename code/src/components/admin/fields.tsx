'use client'

import { useId, useState, type ReactNode } from 'react'
import { useFieldError } from './form'

// Labelled fields with help text and the error from the action, keyboard
// accessible. Values are uncontrolled (defaultValue), so a screen renders
// with what the database has and FormData carries what the user typed.

const input = 'h-10 w-full rounded-lg border border-line-strong bg-paper px-3 text-sm outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-accent/40 aria-[invalid=true]:border-[oklch(0.55_0.17_25)]'

function Shell({ id, label, help, error, children, required }: { id: string; label: string; help?: ReactNode; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="text-ink-muted"> (obligatorio)</span>}
      </label>
      {children}
      {help && !error && (
        <p id={`${id}-help`} className="text-xs text-ink-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-[oklch(0.5_0.17_25)]">
          {error}
        </p>
      )}
    </div>
  )
}

type Base = { name: string; label: string; help?: ReactNode; required?: boolean; disabled?: boolean }

export function TextField({ defaultValue, type = 'text', maxLength, placeholder, ...p }: Base & { defaultValue?: string | number | null; type?: 'text' | 'email' | 'url' | 'number' | 'date' | 'datetime-local' | 'password'; maxLength?: number; placeholder?: string }) {
  const id = useId()
  const error = useFieldError(p.name)
  return (
    <Shell id={id} label={p.label} help={p.help} error={error} required={p.required}>
      <input
        id={id}
        name={p.name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={p.required}
        disabled={p.disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : p.help ? `${id}-help` : undefined}
        className={input}
      />
    </Shell>
  )
}

export function MoneyField({ defaultCents, ...p }: Base & { defaultCents?: number | null }) {
  const v = defaultCents == null ? '' : defaultCents % 100 === 0 ? String(defaultCents / 100) : (defaultCents / 100).toFixed(2).replace('.', ',')
  return <TextField {...p} defaultValue={v} placeholder="18900" help={p.help ?? 'En pesos, sin puntos ni símbolo.'} />
}

export function TextArea({ defaultValue, rows = 4, ...p }: Base & { defaultValue?: string | null; rows?: number }) {
  const id = useId()
  const error = useFieldError(p.name)
  return (
    <Shell id={id} label={p.label} help={p.help} error={error} required={p.required}>
      <textarea
        id={id}
        name={p.name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        required={p.required}
        disabled={p.disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : p.help ? `${id}-help` : undefined}
        className={`${input} h-auto py-2 leading-relaxed`}
      />
    </Shell>
  )
}

export function Checkbox({ defaultChecked, ...p }: Base & { defaultChecked?: boolean }) {
  const id = useId()
  const error = useFieldError(p.name)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm">
        <input id={id} name={p.name} type="checkbox" defaultChecked={defaultChecked} disabled={p.disabled} className="mt-0.5 size-4 accent-ink" />
        <span>
          <span className="font-medium">{p.label}</span>
          {p.help && <span className="block text-xs text-ink-muted">{p.help}</span>}
        </span>
      </label>
      {error && <p className="text-xs font-medium text-[oklch(0.5_0.17_25)]">{error}</p>}
    </div>
  )
}

export function Select({ defaultValue, options, allowEmpty, ...p }: Base & { defaultValue?: string | null; options: { value: string; label: string }[]; allowEmpty?: string }) {
  const id = useId()
  const error = useFieldError(p.name)
  return (
    <Shell id={id} label={p.label} help={p.help} error={error} required={p.required}>
      <select id={id} name={p.name} defaultValue={defaultValue ?? ''} disabled={p.disabled} aria-invalid={!!error} className={input}>
        {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  )
}

/** Several values from a fixed list, as checkboxes sharing a name. */
export function MultiCheck({ defaultValues = [], options, ...p }: Base & { defaultValues?: string[]; options: { value: string; label: string }[] }) {
  const error = useFieldError(p.name)
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{p.label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={p.name} value={o.value} defaultChecked={defaultValues.includes(o.value)} className="size-4 accent-ink" />
            {o.label}
          </label>
        ))}
      </div>
      {p.help && <p className="text-xs text-ink-muted">{p.help}</p>}
      {error && <p className="text-xs font-medium text-[oklch(0.5_0.17_25)]">{error}</p>}
    </fieldset>
  )
}

/** A list of codes or short texts, one per line. */
export function LinesField({ defaultValues = [], rows = 5, ...p }: Base & { defaultValues?: string[]; rows?: number }) {
  return <TextArea {...p} rows={rows} defaultValue={defaultValues.join('\n')} />
}

export type LinkRow = { label: string; href: string; highlight?: boolean }

/** Menu-style list: label, link and "destacado"; rows can be added, removed and reordered. Posted as JSON in `name`. */
export function LinksField({ defaultValue = [], ...p }: Base & { defaultValue?: LinkRow[] }) {
  const [rows, setRows] = useState<LinkRow[]>(defaultValue)
  const error = useFieldError(p.name)
  const update = (i: number, patch: Partial<LinkRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const next = [...r]
      const j = i + d
      if (j < 0 || j >= next.length) return r
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{p.label}</legend>
      <input type="hidden" name={p.name} value={JSON.stringify(rows.filter((r) => r.label.trim() && r.href.trim()))} />
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input aria-label="Texto" value={row.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Texto" className={`${input} w-40 flex-1`} />
          <input aria-label="Link" value={row.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="/productos" className={`${input} w-48 flex-1`} />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={!!row.highlight} onChange={(e) => update(i, { highlight: e.target.checked })} className="size-4 accent-ink" />
            Destacado
          </label>
          <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="rounded px-2 text-sm hover:bg-shell">
            ↑
          </button>
          <button type="button" aria-label="Bajar" onClick={() => move(i, 1)} className="rounded px-2 text-sm hover:bg-shell">
            ↓
          </button>
          <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded px-2 text-sm text-ink-muted hover:bg-shell">
            Quitar
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, { label: '', href: '' }])} className="text-sm font-medium underline underline-offset-2">
        Agregar ítem
      </button>
      {p.help && <p className="text-xs text-ink-muted">{p.help}</p>}
      {error && <p className="text-xs font-medium text-[oklch(0.5_0.17_25)]">{error}</p>}
    </fieldset>
  )
}

/**
 * An image setting or field: shows the current one, offers a file to replace
 * it, or "Quitar". The action reads it with `readImageField` (server/admin/media-field).
 */
export function ImageField({ defaultKey, previewUrl, ...p }: Base & { defaultKey?: string | null; previewUrl?: string | null }) {
  const id = useId()
  const error = useFieldError(p.name)
  return (
    <Shell id={id} label={p.label} help={p.help ?? 'JPG, PNG, WebP o AVIF, hasta 15 MB.'} error={error}>
      <input type="hidden" name={p.name} value={defaultKey ?? ''} />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-24 w-auto rounded-md border border-line object-contain" />
      )}
      <input id={id} name={`${p.name}__file`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="block text-sm" />
      {defaultKey && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name={`${p.name}__remove`} className="size-4 accent-ink" /> Quitar la imagen
        </label>
      )}
    </Shell>
  )
}
