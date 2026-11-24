'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Close, MapPin, Pencil, Plus, Trash } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { PROVINCE_OPTIONS, PROVINCES, type ProvinceCode } from '@/lib/argentina'
import type { FormState } from '@/lib/form-state'
import {
  changePasswordAction,
  defaultAddressAction,
  deleteAccountAction,
  deleteAddressAction,
  newsletterAction,
  saveAddressAction,
  saveProfile,
} from '@/app/(site)/cuenta/actions'
import { CheckField, FieldError, FormMessage, Submit, TextField, useKeepValues } from './fields'

// "Mis datos" (CU-16, CU-17).

export type ProfileData = { email: string; firstName: string; lastName: string; dni: string; phone: string }
export type AddressData = {
  id: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  street: string
  unit: string
  postcode: string
  locality: string
  province: string
  notes: string
  isDefault: boolean
}

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [state, action] = useActionState(saveProfile, null)
  const ref = useRef<HTMLFormElement>(null)
  useKeepValues(ref)
  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="Nombre" autoComplete="given-name" required maxLength={60} defaultValue={initial.firstName} error={e.firstName} />
        <TextField name="lastName" label="Apellido" autoComplete="family-name" maxLength={60} defaultValue={initial.lastName} error={e.lastName} />
        <TextField name="dni" label="DNI" inputMode="numeric" maxLength={12} defaultValue={initial.dni} error={e.dni} />
        <TextField name="phone" label="Teléfono" type="tel" autoComplete="tel" maxLength={25} defaultValue={initial.phone} error={e.phone} />
      </div>
      <div>
        <p className="mb-1.5 text-[0.9375rem] font-medium">Email</p>
        <p className="flex h-13 items-center rounded-2xl bg-shell px-5 text-base text-ink-soft">{initial.email}</p>
      </div>
      <Submit size="md" pendingLabel="Guardando…">
        Guardar
      </Submit>
    </form>
  )
}

// ------------------------------------------------------------ addresses ----

const EMPTY_ADDRESS: Omit<AddressData, 'id' | 'isDefault'> = { firstName: '', lastName: '', dni: '', phone: '', street: '', unit: '', postcode: '', locality: '', province: '', notes: '' }

export function AddressBook({ addresses, profile }: { addresses: AddressData[]; profile: ProfileData }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  return (
    <div className="space-y-4">
      {addresses.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a, i) =>
            editing === a.id ? (
              <li key={a.id} className="md:col-span-2">
                <AddressForm address={a} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={a.id} className={`flex flex-col bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line ${i % 2 ? 'rounded-[2rem_1.25rem_2rem_1.25rem]' : 'rounded-[1.25rem_2rem_1.25rem_2rem]'}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <MapPin size={20} />
                  </span>
                  <div className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">
                    <p className="font-semibold text-ink">
                      {a.firstName} {a.lastName}
                      {a.isDefault && <span className="ml-2 inline-flex rounded-full bg-sage-soft px-2.5 py-0.5 align-middle text-xs font-semibold text-sage-ink">Principal</span>}
                    </p>
                    <p className="text-ink-soft">
                      {a.street}
                      {a.unit && `, ${a.unit}`}
                    </p>
                    <p className="text-ink-soft">
                      {a.postcode} {a.locality}, {PROVINCES[a.province as ProvinceCode] ?? a.province}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <button type="button" onClick={() => setEditing(a.id)} className={buttonClasses('ghost', 'sm')}>
                    <Pencil size={16} /> Editar
                  </button>
                  {!a.isDefault && (
                    <form action={defaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className={buttonClasses('ghost', 'sm')}>
                        Usar como principal
                      </button>
                    </form>
                  )}
                  <form action={deleteAddressAction} className="ml-auto">
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={buttonClasses('ghost', 'sm', 'text-ink-muted hover:text-ink')}>
                      <Trash size={16} /> Eliminar
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editing === 'new' ? (
        <AddressForm address={{ ...EMPTY_ADDRESS, firstName: profile.firstName, lastName: profile.lastName, dni: profile.dni, phone: profile.phone, id: '', isDefault: false }} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex w-full items-center gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] border border-dashed border-line-strong bg-shell/60 p-3 pr-5 text-left transition-colors hover:border-ink-muted"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_8px_18px_-10px_rgb(40_30_20/0.45)]">
            <Plus size={22} />
          </span>
          <span className="font-semibold">Agregar una dirección</span>
        </button>
      )}
    </div>
  )
}

function AddressForm({ address, onDone }: { address: AddressData; onDone: () => void }) {
  const [state, action] = useActionState(saveAddressAction, null)
  const ref = useRef<HTMLFormElement>(null)
  const provinceId = useId()
  useKeepValues(ref)
  useEffect(() => {
    if (state?.ok) onDone()
  }, [state, onDone])
  const e = state?.errors ?? {}
  return (
    <form ref={ref} action={action} className="tex-linen space-y-5 rounded-[1.5rem_2.5rem_1.5rem_2.5rem] bg-shell p-5 ring-1 ring-line sm:p-7" noValidate>
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-[1.25rem]">{address.id ? 'Editar dirección' : 'Agregar una dirección'}</p>
        <button type="button" onClick={onDone} aria-label="Cancelar" className="grid size-10 place-items-center rounded-full bg-paper hover:bg-sand">
          <Close size={18} />
        </button>
      </div>
      <input type="hidden" name="id" value={address.id} />
      {state && !state.ok && <FormMessage state={state} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="Nombre" autoComplete="given-name" maxLength={60} defaultValue={address.firstName} error={e.firstName} />
        <TextField name="lastName" label="Apellido" autoComplete="family-name" maxLength={60} defaultValue={address.lastName} error={e.lastName} />
        <TextField name="dni" label="DNI" inputMode="numeric" maxLength={12} defaultValue={address.dni} error={e.dni} />
        <TextField
          name="phone"
          label={
            <>
              Teléfono <span className="font-normal text-ink-muted">(para coordinar la entrega)</span>
            </>
          }
          type="tel"
          autoComplete="tel"
          maxLength={25}
          defaultValue={address.phone}
          error={e.phone}
        />
        <TextField name="street" label="Calle y número" autoComplete="address-line1" maxLength={120} defaultValue={address.street} error={e.street} className="sm:col-span-2" />
        <TextField name="unit" label="Piso y depto" optional autoComplete="address-line2" maxLength={40} defaultValue={address.unit} error={e.unit} />
        <TextField name="postcode" label="Código postal" autoComplete="postal-code" maxLength={10} defaultValue={address.postcode} error={e.postcode} />
        <TextField name="locality" label="Localidad" autoComplete="address-level2" maxLength={80} defaultValue={address.locality} error={e.locality} />
        <div>
          <p id={provinceId} className="mb-1.5 block text-[0.9375rem] font-medium">
            Provincia
          </p>
          <Select name="province" options={PROVINCE_OPTIONS} defaultValue={address.province} labelledBy={provinceId} invalid={!!e.province} describedBy={e.province ? `${provinceId}-error` : undefined} />
          <FieldError id={`${provinceId}-error`} error={e.province} />
        </div>
        <TextField name="notes" label="Indicaciones para la entrega" optional maxLength={300} defaultValue={address.notes} error={e.notes} className="sm:col-span-2" />
      </div>
      {!address.isDefault && <CheckField name="isDefault">Usar como principal</CheckField>}
      <div className="flex flex-wrap gap-3">
        <Submit size="md" pendingLabel="Guardando…">
          Guardar
        </Submit>
        <button type="button" onClick={onDone} className={buttonClasses('secondary')}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ------------------------------------------------------------- password ----

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null)
  const ref = useRef<HTMLFormElement>(null)
  const e = state?.errors ?? {}
  // After a change, the fields empty; after an error, they keep what she typed.
  useEffect(() => {
    const form = ref.current
    if (!form || state?.ok) return
    const keep = (ev: Event) => ev.preventDefault()
    form.addEventListener('reset', keep)
    return () => form.removeEventListener('reset', keep)
  }, [state])
  return (
    <form ref={ref} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField name="current" label="Contraseña actual" type="password" autoComplete="current-password" maxLength={200} error={e.current} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="password" label={<>Nueva contraseña <span className="font-normal text-ink-muted">(al menos 8 caracteres)</span></>} type="password" autoComplete="new-password" maxLength={200} error={e.password} />
        <TextField name="repeat" label="Repetila" type="password" autoComplete="new-password" maxLength={200} error={e.repeat} />
      </div>
      <Submit size="md" pendingLabel="Guardando…">
        Guardar
      </Submit>
    </form>
  )
}

// --------------------------------------------------------- newsletter ----

/** Comunicaciones: newsletter yes or no, a switch that saves as soon as it moves. */
export function NewsletterSwitch({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState(newsletterAction, null)
  const [checked, setChecked] = useState(on)
  const ref = useRef<HTMLFormElement>(null)
  const id = useId()
  useKeepValues(ref) // a form reset would put the box back to its first state while React keeps the new one
  return (
    <form ref={ref} action={action} className="space-y-4">
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-5 rounded-[1.25rem_2rem_1.25rem_2rem] bg-shell px-5 py-4">
        <span className="text-[1rem] font-medium">Quiero recibir el newsletter</span>
        <span className="relative inline-flex shrink-0">
          <input
            id={id}
            type="checkbox"
            name="newsletter"
            role="switch"
            checked={checked}
            disabled={pending}
            onChange={(ev) => {
              setChecked(ev.target.checked)
              requestAnimationFrame(() => ref.current?.requestSubmit())
            }}
            className="peer !absolute !inset-0 !m-0 !size-full cursor-pointer !appearance-none !rounded-full !border-0 !bg-transparent !shadow-none opacity-0 before:!hidden"
          />
          <span aria-hidden="true" className="h-8 w-14 rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
          <span aria-hidden="true" className="absolute left-1 top-1 size-6 rounded-full bg-paper shadow-[0_2px_6px_rgb(40_30_20/0.3)] transition-transform duration-300 ease-[var(--ease-out-soft)] peer-checked:translate-x-6" />
        </span>
      </label>
      <FormMessage state={state} />
    </form>
  )
}

// ------------------------------------------------------------- delete ----

/** CU-17: the explanation, then Eliminar · Cancelar. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState<FormState>(deleteAccountAction, null)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses('secondary', 'md', 'text-[oklch(0.45_0.15_25)] hover:border-[oklch(0.45_0.15_25)]')}>
        <Trash size={18} /> Eliminar mi cuenta
      </button>
    )
  }
  return (
    <form action={action} className="animate-pop space-y-5 rounded-[1.5rem_2.5rem_1.5rem_2.5rem] bg-[oklch(0.97_0.015_25)] p-5 ring-1 ring-[oklch(0.88_0.04_25)] sm:p-7">
      <p className="font-display text-[1.3rem] leading-snug">¿Querés eliminar tu cuenta?</p>
      <p className="text-[1rem] leading-relaxed text-ink-soft">
        Borramos tus datos de perfil, tu historial de diagnósticos, tu rutina y tus favoritos. Los datos de tus compras los tenemos que guardar por obligaciones fiscales y contables durante el plazo que exige la ley.
      </p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <Submit size="md" className="!bg-[oklch(0.45_0.15_25)] hover:!bg-[oklch(0.4_0.15_25)]" pendingLabel="Eliminando…">
          Eliminar
        </Submit>
        <button type="button" onClick={() => setOpen(false)} className={buttonClasses('secondary')}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
