'use client'

import { useActionState, useRef } from 'react'
import { Check, IconBadge } from '@/components/icons'
import { sendWithdrawal } from '@/app/(site)/arrepentimiento/actions'
import { FormMessage, Submit, TextArea, TextField, useKeepValues } from '@/components/account/fields'

// LE-04: N° de pedido · Email o teléfono de la compra · Motivo (opcional) —
// Enviar — and the confirmation with the procedure code.
export function WithdrawalForm({ orderNumber }: { orderNumber: string }) {
  const [state, action] = useActionState(sendWithdrawal, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)

  if (state?.ok && state.code) {
    return (
      <div role="status" className="animate-pop flex flex-col gap-5 rounded-[1.5rem_3rem_1.5rem_3rem] bg-sage-soft p-6 text-sage-ink sm:flex-row sm:items-start sm:p-8">
        <IconBadge size="lg" tone="paper">
          <Check size={28} />
        </IconBadge>
        <p className="font-display text-[1.35rem] leading-snug text-ink md:text-[1.5rem]">
          Recibimos tu pedido de arrepentimiento. Tu código de trámite es <strong className="whitespace-nowrap font-bold tabular text-sage-ink">{state.code}</strong>. Te escribimos dentro de las 24 horas para coordinar el retiro.
        </p>
      </div>
    )
  }

  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="orderNumber" label="N° de pedido" required maxLength={30} defaultValue={orderNumber} autoComplete="off" error={e.orderNumber} />
        <TextField name="contact" label="Email o teléfono de la compra" required maxLength={200} autoComplete="email" error={e.contact} />
      </div>
      <TextArea name="reason" label="Motivo" optional rows={4} maxLength={1000} />
      <Submit pendingLabel="Enviando…">Enviar</Submit>
    </form>
  )
}
