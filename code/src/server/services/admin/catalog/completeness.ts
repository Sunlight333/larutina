// Completeness indicator (Phase 1 step 3): how much of what the full catalog
// requires (the S1 and S5 columns of Productos in the template) a product
// already has, plus at least one image. Shown in the list and the editor.
import { SHEETS } from '@/server/catalog-import/spec'
import { DATA_FIELDS } from './product-fields'

export type CompletenessInput = {
  type: string
  images: string[]
  inciText: string | null
  /** Ingredient rows (a product without INCI text may list them one by one). */
  ingredientCount: number
  complementaryCount: number
} & Record<string, unknown>

export type Completeness = { percent: number; missing: { key: string; label: string }[] }

// Not counted: the code and the status always exist, the type has a default,
// and "sin_fragancia" is computed from the ingredients (CAT-08).
const SKIP = new Set(['codigo_producto', 'estado', 'tipo', 'sin_fragancia'])
const OTHER_LABELS: Record<string, string> = {
  imagenes: 'Al menos una imagen',
  complementarios: 'Productos complementarios',
  inci: 'Lista INCI',
}

const REQUIRED = SHEETS.Productos.fields.filter((f) => (f.req === 'S1' || f.req === 'S5') && !SKIP.has(f.key))
const byKey = new Map(DATA_FIELDS.filter((f) => f.key).map((f) => [f.key!, f]))

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '')

export function productCompleteness(p: CompletenessInput): Completeness {
  const missing: Completeness['missing'] = []
  for (const f of REQUIRED) {
    let ok: boolean
    if (f.key === 'imagenes') ok = p.images.length > 0
    else if (f.key === 'complementarios') ok = p.complementaryCount > 0
    // Kits and travel sizes take their ingredients from what they contain or their base product.
    else if (f.key === 'inci') ok = p.type !== 'PRODUCT' || !!p.inciText || p.ingredientCount > 0
    else {
      const field = byKey.get(f.key)
      ok = field ? filled(p[field.name]) : true
    }
    if (!ok) missing.push({ key: f.key, label: OTHER_LABELS[f.key] ?? byKey.get(f.key)?.label ?? f.key })
  }
  const total = REQUIRED.length
  return { percent: Math.round(((total - missing.length) / total) * 100), missing }
}
