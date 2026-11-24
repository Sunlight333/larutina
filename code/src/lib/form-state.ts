/** What a storefront form's server action answers: a message for the whole form and errors next to each field. */
export type FormState = { ok: boolean; message?: string; errors?: Record<string, string>; code?: string } | null

export const TOO_MANY = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.'
export const CHECK_FIELDS = 'Revisá los campos marcados.'

export const formText = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

/** Passwords are taken as typed: spaces count. */
export const formRaw = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v : ''
}
