// The data-quality rules of the v1.1 template (CAT-13, CAT-22), as plain
// functions. The importer and the panel both call these, so a value the panel
// accepts is one the import accepts too, with the same message.
import { LISTS, listLabels, lookup } from './lists'
import type { Field } from './spec'

export const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NUMBER_RE = /^-?\d+(?:[.,]\d+)?$/

export type CellValue = string | number | boolean | string[] | null
export type Parsed = { ok: true; value: CellValue } | { ok: false; message: string }

export const splitList = (raw: string, sep: string) =>
  raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean)

function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, '')
  if (!NUMBER_RE.test(s)) return null
  return Number(s.replace(',', '.'))
}

export const codeMessage = (raw: string) => `"${raw}" no es un código válido: solo minúsculas, números y guiones, sin espacios ni acentos.`

/** One non-empty cell of a template column, typed; or the reason it is not valid. */
export function parseCell(field: Field, raw: string): Parsed {
  const bad = (message: string): Parsed => ({ ok: false, message })
  const good = (value: CellValue): Parsed => ({ ok: true, value })
  switch (field.type) {
    case 'text':
      if (field.maxLength && raw.length > field.maxLength) return bad(`Tiene ${raw.length} caracteres; el máximo es ${field.maxLength}.`)
      return good(raw)
    case 'code':
    case 'ref':
      if (!CODE_RE.test(raw)) return bad(codeMessage(raw))
      return good(raw)
    case 'refs': {
      const codes = splitList(raw, ';')
      const wrong = codes.filter((c) => !CODE_RE.test(c))
      if (wrong.length) return bad(`Códigos no válidos: ${wrong.map((w) => `"${w}"`).join(', ')}. Solo minúsculas, números y guiones, separados por punto y coma.`)
      return good(codes)
    }
    case 'texts':
      return good(splitList(raw, ';'))
    case 'pipes':
      return good(splitList(raw, '|'))
    case 'int':
    case 'number':
    case 'money': {
      // "18.900" is how a price is written in Argentina, but in a cell it reads
      // as 18.9: amounts with a thousands separator are rejected, not guessed.
      if (field.type === 'money' && /^\d{1,3}([.,]\d{3})+$/.test(raw.replace(/\s/g, ''))) return bad(`"${raw}": cargá el precio sin puntos ni símbolos (por ejemplo 18900).`)
      const n = parseNumber(raw)
      if (n === null) return bad(`"${raw}" no es un número.`)
      if (field.type === 'int' && !Number.isInteger(n)) return bad(`"${raw}" tiene que ser un número entero.`)
      if (field.type === 'money' && !/^-?\d+(?:[.,]\d{1,2})?$/.test(raw.replace(/\s/g, ''))) return bad(`"${raw}" tiene más de dos decimales.`)
      if (field.min !== undefined && n < field.min) return bad(`${raw} es menor que el mínimo (${field.min}).`)
      if (field.max !== undefined && n > field.max) return bad(`${raw} es mayor que el máximo (${field.max}).`)
      return good(n)
    }
    case 'yesno': {
      const v = lookup(LISTS.si_no, raw)
      if (!v) return bad(`"${raw}": tiene que ser Sí o No.`)
      return good(v === 'true')
    }
    case 'list': {
      const def = LISTS[field.list!]
      const v = lookup(def, raw)
      if (!v) return bad(`"${raw}" no está en la lista. Valores posibles: ${listLabels(def)}.`)
      return good(v)
    }
    case 'multi': {
      const def = LISTS[field.list!]
      const values: string[] = []
      for (const part of splitList(raw, ';')) {
        const v = lookup(def, part)
        if (!v) return bad(`"${part}" no está en la lista. Valores posibles: ${listLabels(def)}.`)
        values.push(v)
      }
      return good(values)
    }
  }
}

// ---------------------------------------------------------- product texts ----

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** CAT-13: the headline has at most 8 words. */
export function headlineProblem(headline: string | null): string | null {
  if (!headline) return null
  const n = words(headline)
  return n > 8 ? `Tiene ${n} palabras; el máximo es 8.` : null
}

/** CAT-13: at most 3 chips of at most 20 characters. */
export function chipsProblems(chips: string[]): string[] {
  const out: string[] = []
  if (chips.length > 3) out.push(`Tiene ${chips.length} chips; el máximo es 3.`)
  for (const c of chips) if (c.length > 20) out.push(`"${c}" tiene ${c.length} caracteres; el máximo es 20.`)
  return out
}

/** Benefits not in the "VERBO: texto" format (a warning, never an error). */
export function badBenefits(benefits: string[]): string[] {
  return benefits.filter((b) => !/^[^:]{2,}:\s*\S/.test(b))
}

export const benefitsWarning = (bad: string[]) => `Formato esperado "VERBO: texto": revisá ${bad.map((b) => `"${b.slice(0, 40)}"`).join(', ')}.`

/** CAT-22: the promotional price is below the price (both in the same unit). */
export function promoProblem(price: number | null, promo: number | null, fmt: (n: number) => string = String): string | null {
  if (price === null || promo === null || promo < price) return null
  return `El precio promocional (${fmt(promo)}) tiene que ser menor al precio (${fmt(price)}).`
}
