import { safeReturnPath } from '@/lib/return-path'

export type SearchParams = Record<string, string | string[] | undefined>

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

/** Where the sign-in screens send her back to, and the product to save on the way (PDP-09). */
export function backParams(sp: SearchParams): { returnTo: string; save: string | null } {
  const save = one(sp.guardar)
  return { returnTo: safeReturnPath(one(sp.volver)), save: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(save) && save.length <= 120 ? save : null }
}
