// A product's ingredient list and its family flags (CAT-08, CAT-19), shared by
// the importer and the panel's product editor so both build the same list
// from the same INCI text and compute the same flags.
import { codeFromInci, inciCandidates, inciKey, splitInci } from './inci'

export const FLAG_COLUMNS = {
  sin_fragancia: 'fragranceFree',
  sin_aceites_esenciales: 'essentialOilFree',
  contiene_retinoide: 'containsRetinoid',
  contiene_acido_exfoliante: 'containsExfoliatingAcid',
  sin_alcohol: 'alcoholFree',
  sin_parabenos: 'parabenFree',
  sin_siliconas: 'siliconeFree',
  sin_sulfatos: 'sulfateFree',
} as const
export type ProductFlags = Record<(typeof FLAG_COLUMNS)[keyof typeof FLAG_COLUMNS], boolean>

/** Free of everything until an ingredient's family says otherwise. */
export const defaultFlags = (): ProductFlags => ({
  fragranceFree: true,
  essentialOilFree: true,
  containsRetinoid: false,
  containsExfoliatingAcid: false,
  alcoholFree: true,
  parabenFree: true,
  siliconeFree: true,
  sulfateFree: true,
})

/** Flags from the families of the ingredients: "sin_…" turns false, "contiene_…" true. */
export function computeFlags(codes: Iterable<string>, familyOf: (code: string) => string | null | undefined, computesOf: (family: string) => string[] | undefined): ProductFlags {
  const flags = defaultFlags()
  for (const code of codes) {
    const fam = familyOf(code)
    if (!fam) continue
    for (const flag of computesOf(fam) ?? []) {
      const column = FLAG_COLUMNS[flag as keyof typeof FLAG_COLUMNS]
      if (column) flags[column] = flag.startsWith('contiene_')
    }
  }
  return flags
}

export type NewIngredient = { code: string; commonName: string; inciName: string; inciKey: string }

/**
 * Matches INCI names to ingredient codes by normalized key and usual
 * spellings. An unknown name becomes a new ingredient (status REVIEW when
 * written) with a code derived from the name, never one already used.
 */
export function inciMatcher(byInci: Map<string, string>, usedCodes: Set<string>) {
  const created = new Map<string, NewIngredient>()
  const match = (name: string): string => {
    for (const key of inciCandidates(name)) {
      const code = byInci.get(key)
      if (code) return code
    }
    const key = inciKey(name)
    let code = codeFromInci(name)
    for (let n = 2; usedCodes.has(code); n++) code = `${codeFromInci(name)}-${n}`
    usedCodes.add(code)
    created.set(code, { code, commonName: name, inciName: name, inciKey: key })
    byInci.set(key, code)
    return code
  }
  return { match, created }
}

export type ListItem = { code: string; inciOrder: number; isStar: boolean; concentration: string | null }
export type Highlight<T> = { code: string; isStar: boolean; concentration: string | null; inciOrder?: number | null; source: T }

export type ListIssue<T> =
  | { kind: 'repeated-in-inci'; name: string }
  | { kind: 'not-in-inci'; item: Highlight<T> }
  | { kind: 'repeated-row'; item: Highlight<T> }

/**
 * With INCI text, the text gives the full ordered list and the highlights
 * mark star ingredients and concentrations (one not in the text is added at
 * the end). Without it, the highlights are the list, ordered by inciOrder.
 */
export function buildIngredientList<T>(inciText: string | null, highlights: Highlight<T>[], match: (name: string) => string, onIssue: (issue: ListIssue<T>) => void): ListItem[] {
  const list: ListItem[] = []
  const position = new Map<string, number>()
  if (inciText) {
    for (const name of splitInci(inciText)) {
      const code = match(name)
      if (position.has(code)) {
        onIssue({ kind: 'repeated-in-inci', name })
        continue
      }
      position.set(code, list.length)
      list.push({ code, inciOrder: list.length + 1, isStar: false, concentration: null })
    }
    for (const h of highlights) {
      const at = position.get(h.code)
      if (at === undefined) {
        onIssue({ kind: 'not-in-inci', item: h })
        position.set(h.code, list.length)
        list.push({ code: h.code, inciOrder: list.length + 1, isStar: h.isStar, concentration: h.concentration })
        continue
      }
      const item = list[at]!
      item.isStar = h.isStar
      item.concentration = h.concentration
    }
    return list
  }
  const sorted = [...highlights].sort((a, b) => (a.inciOrder ?? 0) - (b.inciOrder ?? 0))
  for (const h of sorted) {
    if (position.has(h.code)) {
      onIssue({ kind: 'repeated-row', item: h })
      continue
    }
    position.set(h.code, list.length)
    list.push({ code: h.code, inciOrder: h.inciOrder ?? list.length + 1, isStar: h.isStar, concentration: h.concentration })
  }
  return list
}

/** The loaded "sin_fragancia" against the computed one (CAT-08): the computed value is what gets published. */
export function fragranceMismatch(declared: boolean | null, computed: boolean): string | null {
  if (declared === null || declared === computed) return null
  return computed
    ? 'Cargado "No", pero ningún ingrediente del INCI es de la familia fragancia o aceite esencial. Se publica lo calculado: revisá el INCI o las familias.'
    : 'Cargado "Sí", pero el INCI tiene un ingrediente de la familia fragancia o aceite esencial. Se publica lo calculado: "No".'
}
