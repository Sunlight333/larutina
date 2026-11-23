// Reads a panel form against the template columns of a sheet: the same
// types, limits and messages as the import (parseCell), with the S1 columns
// required.
import { parseCell } from '@/server/catalog-import/rules'
import { SHEETS, type SheetName } from '@/server/catalog-import/spec'

export type FormInput = Record<string, string | undefined>

export function readTemplateFields<N extends string>(sheet: SheetName, mapping: Record<N, string>, input: FormInput) {
  const values = {} as Record<N, string | number | boolean | string[] | null>
  const errors: Record<string, string> = {}
  for (const [name, key] of Object.entries(mapping) as [N, string][]) {
    const field = SHEETS[sheet].fields.find((f) => f.key === key)
    if (!field) throw new Error(`Unknown column ${sheet}.${key}`)
    const raw = (input[name] ?? '').trim()
    if (raw === '') {
      if (field.req === 'S1' || field.req === 'row') errors[name] = 'Campo obligatorio.'
      values[name] = field.type === 'texts' || field.type === 'refs' || field.type === 'pipes' ? [] : null
      continue
    }
    const parsed = parseCell(field, raw)
    if (parsed.ok) values[name] = parsed.value
    else errors[name] = parsed.message
  }
  return { values, errors }
}
