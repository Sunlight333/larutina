'use client'

import { useActionState, type ReactNode } from 'react'
import type { FormState } from '@/server/admin/forms'
import { SubmitButton } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import type { BulkState } from './types'

// Two steps, as CAT-04 asks: "Ver vista previa" shows every change old → new
// and every problem by row; "Aplicar N cambios" sends that exact set, which
// the server checks again and applies in one transaction.
export function BulkTool({
  previewAction,
  applyAction,
  children,
  encType,
}: {
  previewAction: (prev: BulkState, form: FormData) => Promise<BulkState>
  applyAction: (prev: FormState, form: FormData) => Promise<FormState>
  children: ReactNode
  encType?: 'multipart/form-data'
}) {
  const [preview, previewDispatch] = useActionState(previewAction, null)
  // Each result is stamped, so it is shown only with the preview it was sent for.
  const [applied, applyDispatch] = useActionState(async (prev: FormState, form: FormData) => ({ ...(await applyAction(prev, form)), at: Date.now() }) as FormState, null)
  const fresh = !!applied && !!preview?.at && (applied.at ?? 0) > preview.at
  const appliedThis = fresh && !!applied?.ok
  return (
    <div className="space-y-4">
      <form action={previewDispatch} encType={encType} className="space-y-4">
        <KeepInput />
        {children}
        <SubmitButton variant="secondary">Ver vista previa</SubmitButton>
      </form>

      {preview?.message && !appliedThis && (
        <div role={preview.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-sm ${preview.ok ? 'bg-night-soft text-night' : 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.15_25)]'}`}>
          {preview.message}
        </div>
      )}

      {!appliedThis && preview?.errors && preview.errors.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="px-3 py-2 text-left text-sm font-medium">Errores</caption>
            <thead className="bg-shell/60 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Fila</th>
                <th scope="col" className="px-3 py-2 font-medium">SKU o producto</th>
                <th scope="col" className="px-3 py-2 font-medium">Problema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.errors.map((e, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 tabular-nums">{e.row ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.ref}</td>
                  <td className="px-3 py-1.5">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!appliedThis && preview?.rows && preview.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="px-3 py-2 text-left text-sm font-medium">Vista previa</caption>
            <thead className="bg-shell/60 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Fila</th>
                <th scope="col" className="px-3 py-2 font-medium">SKU o producto</th>
                <th scope="col" className="px-3 py-2 font-medium">Producto</th>
                <th scope="col" className="px-3 py-2 font-medium">Campo</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Antes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 tabular-nums text-ink-muted">{r.row ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.ref}</td>
                  <td className="px-3 py-1.5">{r.product}</td>
                  <td className="px-3 py-1.5">{r.what}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{r.from}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{r.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!appliedThis && preview?.payload && (
        <form action={applyDispatch}>
          <input type="hidden" name="payload" value={preview.payload} />
          <SubmitButton confirm={`¿Aplicar ${preview.count} cambios?`}>{`Aplicar ${preview.count} ${preview.count === 1 ? 'cambio' : 'cambios'}`}</SubmitButton>
        </form>
      )}

      {fresh && applied?.message && (
        <div role={applied.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-sm ${applied.ok ? 'bg-sage-soft text-sage-ink' : 'bg-[oklch(0.95_0.03_25)] text-[oklch(0.45_0.15_25)]'}`}>
          {applied.message}
        </div>
      )}
    </div>
  )
}
