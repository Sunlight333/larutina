import type { ZodError } from 'zod'

// Server side of the generic admin forms: read FormData into plain values and
// turn validation problems into per-field messages (shown by the fields).

export type FormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string>; at?: number } | null

export const ok = (message = 'Guardado.'): FormState => ({ ok: true, message, at: Date.now() })
export const fail = (message: string, fieldErrors?: Record<string, string>): FormState => ({ ok: false, message, fieldErrors })

export function fromZod(error: ZodError, message = 'Revisá los campos marcados.'): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    fieldErrors[key] ??= issue.message
  }
  return fail(message, fieldErrors)
}

export const str = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

export const optStr = (form: FormData, name: string) => str(form, name) || null

export const bool = (form: FormData, name: string) => form.get(name) === 'on' || form.get(name) === 'true'

export function int(form: FormData, name: string): number | null {
  const v = str(form, name)
  if (v === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isInteger(n) ? n : NaN
}

/** "18900" or "18900,50" → centavos; "" → null; invalid → NaN. */
export function moneyCents(form: FormData, name: string): number | null {
  const v = str(form, name).replace(/\s|\$/g, '')
  if (v === '') return null
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(v)) return NaN
  const [whole, frac = ''] = v.split(/[.,]/)
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** One value per line, trimmed, empty lines dropped. */
export const lines = (form: FormData, name: string) =>
  str(form, name)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/** Uploaded files of a file input, skipping the empty entry browsers send. */
export async function files(form: FormData, name: string) {
  const out: { name: string; type: string; data: Buffer }[] = []
  for (const f of form.getAll(name)) {
    if (typeof f === 'string' || f.size === 0) continue
    out.push({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })
  }
  return out
}
