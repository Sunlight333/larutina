'use client'

import Link from 'next/link'
import { useActionState, useRef, type ReactNode } from 'react'
import { askReset, register, setNewPassword, signIn } from '@/app/(site)/cuenta/actions'
import { CheckField, FormMessage, Submit, TextField, useKeepValues } from './fields'

type Back = { returnTo: string; save: string | null }

function BackFields({ returnTo, save }: Back) {
  return (
    <>
      <input type="hidden" name="volver" value={returnTo} />
      {save && <input type="hidden" name="guardar" value={save} />}
    </>
  )
}

const linkClass = 'font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink'

/** CU-01, CU-02. */
export function SignInForm({ back, createHref }: { back: Back; createHref: string }) {
  const [state, action] = useActionState(signIn, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <BackFields {...back} />
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required maxLength={200} />
      <div>
        <TextField name="password" label="Contraseña" type="password" autoComplete="current-password" required maxLength={200} />
        <p className="mt-2 text-right text-[0.9375rem]">
          <Link href="/cuenta/recuperar" className={linkClass}>
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
      <Submit className="w-full" pendingLabel="Ingresando…">
        Ingresar
      </Submit>
      <p className="text-center text-[0.9375rem] text-ink-soft">
        ¿No tenés cuenta?{' '}
        <Link href={createHref} className={linkClass}>
          Creala
        </Link>
      </p>
    </form>
  )
}

/** CU-03. */
export function RegisterForm({ back, terms }: { back: Back; terms: ReactNode }) {
  const [state, action] = useActionState(register, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)
  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <BackFields {...back} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <FormMessage state={state} />
      <TextField name="name" label="Nombre" autoComplete="given-name" required maxLength={60} error={e.name} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required maxLength={200} error={e.email} />
      <TextField
        name="password"
        label={
          <>
            Contraseña <span className="font-normal text-ink-muted">(al menos 8 caracteres)</span>
          </>
        }
        type="password" autoComplete="new-password" required minLength={8} maxLength={200} error={e.password} />
      <div className="space-y-3.5 pt-1">
        <CheckField name="terms" error={e.terms}>
          {terms}
        </CheckField>
        <CheckField name="newsletter">Quiero recibir el newsletter</CheckField>
      </div>
      <Submit className="w-full" pendingLabel="Creando tu cuenta…">
        Crear cuenta
      </Submit>
    </form>
  )
}

/** CU-04. */
export function ResetRequestForm() {
  const [state, action] = useActionState(askReset, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)
  if (state?.ok) return <FormMessage state={state} />
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required maxLength={200} error={state?.errors?.email} />
      <Submit className="w-full" pendingLabel="Enviando…">
        Enviar link
      </Submit>
    </form>
  )
}

/** CU-05. */
export function NewPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(setNewPassword, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)
  if (state?.code === 'expired') return <ExpiredLink />
  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="t" value={token} />
      <FormMessage state={state} />
      <TextField name="password" label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={8} maxLength={200} error={e.password} />
      <TextField name="repeat" label="Repetila" type="password" autoComplete="new-password" required maxLength={200} error={e.repeat} />
      <Submit className="w-full" pendingLabel="Guardando…">
        Guardar
      </Submit>
    </form>
  )
}

/** CU-05: 'Este link ya venció. Pedí uno nuevo.' */
export function ExpiredLink() {
  return (
    <p role="alert" className="rounded-2xl bg-accent-soft px-5 py-4 text-[1rem] text-ink">
      Este link ya venció.{' '}
      <Link href="/cuenta/recuperar" className={linkClass}>
        Pedí uno nuevo.
      </Link>
    </p>
  )
}
