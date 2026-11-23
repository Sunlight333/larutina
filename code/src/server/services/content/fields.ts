// Field schema for panel-edited content (CMS-01). One description per field
// drives the admin form (which input, label, help), the reading of the
// submitted form and the validation, so a block type is mostly data. Pure:
// no database, safe to pass to client components as props.

type Common = { name: string; label: string; help?: string; required?: boolean }

export type ScalarField =
  | (Common & { kind: 'text'; max?: number; placeholder?: string })
  | (Common & { kind: 'textarea'; max?: number; rows?: number })
  | (Common & { kind: 'markdown'; rows?: number })
  | (Common & { kind: 'link' })
  | (Common & { kind: 'image' })
  | (Common & { kind: 'focal' })
  | (Common & { kind: 'boolean' })
  | (Common & { kind: 'select'; options: { value: string; label: string }[] })
  | (Common & { kind: 'codes'; max?: number })
  | (Common & { kind: 'number'; min: number; max: number })

export type ListField = Common & { kind: 'list'; itemLabel: string; max: number; fields: ScalarField[] }
export type FieldDef = ScalarField | ListField

export type Focal = { x: number; y: number }
export type ScalarValue = string | boolean | number | string[] | Focal
export type ListRow = { _id: string } & Record<string, ScalarValue>
export type FieldValue = ScalarValue | ListRow[]
export type FieldData = Record<string, FieldValue>

const DEFAULT_MAX = { text: 200, textarea: 2000, markdown: 40000 } as const

export const CODE_RE = /^[a-z0-9][a-z0-9_-]*$/
export const ROW_ID_RE = /^[A-Za-z0-9_-]{1,40}$/

/** A link the site may point to: a path of the site, an anchor, http(s) or mailto. */
export function linkProblem(href: string): string | null {
  if (!href) return null
  if (/^\/(?![/\\])/.test(href) || /^#[\w-]*$/.test(href) || /^https?:\/\/[^/\s]+/i.test(href) || /^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return null
  return 'El link tiene que empezar con / (una página del sitio) o con https://'
}

function emptyScalar(f: ScalarField): ScalarValue {
  switch (f.kind) {
    case 'focal':
      return { x: 50, y: 50 }
    case 'boolean':
      return false
    case 'codes':
      return []
    case 'number':
      return f.min
    case 'select':
      return f.options[0]?.value ?? ''
    default:
      return ''
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Coerces a stored value into the field's shape, so renderers never meet a missing or mistyped value. */
function normalizeScalar(f: ScalarField, v: unknown): ScalarValue {
  switch (f.kind) {
    case 'focal': {
      const o = (v ?? {}) as Partial<Focal>
      const x = Number(o.x)
      const y = Number(o.y)
      return { x: Number.isFinite(x) ? clamp(x, 0, 100) : 50, y: Number.isFinite(y) ? clamp(y, 0, 100) : 50 }
    }
    case 'boolean':
      return v === true
    case 'codes':
      return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : []
    case 'number': {
      const n = Number(v)
      return Number.isFinite(n) ? clamp(Math.round(n), f.min, f.max) : f.min
    }
    case 'select':
      return typeof v === 'string' && f.options.some((o) => o.value === v) ? v : (f.options[0]?.value ?? '')
    default:
      return typeof v === 'string' ? v : ''
  }
}

export function normalizeFields(fields: FieldDef[], raw: unknown): FieldData {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: FieldData = {}
  for (const f of fields) {
    if (f.kind === 'list') {
      const rows = Array.isArray(src[f.name]) ? (src[f.name] as unknown[]) : []
      out[f.name] = rows.slice(0, f.max).map((r, i) => {
        const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
        const id = typeof row._id === 'string' && ROW_ID_RE.test(row._id) ? row._id : `r${i}`
        return { _id: id, ...normalizeFields(f.fields, row) } as ListRow
      })
    } else out[f.name] = normalizeScalar(f, src[f.name])
  }
  return out
}

export function emptyFields(fields: FieldDef[]): FieldData {
  return Object.fromEntries(fields.map((f) => [f.name, f.kind === 'list' ? [] : emptyScalar(f)]))
}

// ------------------------------------------------------------ form input ----

/**
 * Reads fields named `${prefix}.${field}` from a submitted form. A list posts
 * its row ids in order as JSON under its own name, and each row's fields as
 * `${prefix}.${list}.${rowId}.${field}`. Images go through `readImage`, which
 * uploads a new file or reports why it could not.
 */
export async function readFields(
  form: FormData,
  fields: FieldDef[],
  prefix: string,
  readImage: ImageReader,
  errors: Record<string, string>,
): Promise<FieldData> {
  const out: FieldData = {}
  for (const f of fields) {
    const name = prefix ? `${prefix}.${f.name}` : f.name
    if (f.kind === 'list') {
      let ids: string[] = []
      try {
        const parsed = JSON.parse(String(form.get(name) ?? '[]')) as unknown
        ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && ROW_ID_RE.test(x)) : []
      } catch {
        errors[name] = 'La lista no es válida.'
      }
      const rows: ListRow[] = []
      for (const id of ids) rows.push({ _id: id, ...(await readFields(form, f.fields, `${name}.${id}`, readImage, errors)) } as ListRow)
      out[f.name] = rows
      continue
    }
    out[f.name] = await readScalar(form, f, name, readImage, errors)
  }
  return out
}

/** The stored key of an image input, or the upload problem to show next to it. */
export type ImageReader = (name: string) => Promise<string | { error: string }>

const formStr = (form: FormData, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

async function readScalar(form: FormData, f: ScalarField, name: string, readImage: ImageReader, errors: Record<string, string>): Promise<ScalarValue> {
  switch (f.kind) {
    case 'image': {
      const r = await readImage(name)
      if (typeof r === 'string') return r
      errors[name] = r.error
      return formStr(form, name)
    }
    case 'focal':
      return { x: Number(formStr(form, `${name}.x`) || 50), y: Number(formStr(form, `${name}.y`) || 50) }
    case 'boolean':
      return form.get(name) === 'on' || form.get(name) === 'true'
    case 'codes':
      return formStr(form, name)
        .split(/[\s,]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    case 'number':
      return Number(formStr(form, name).replace(',', '.'))
    case 'markdown':
    case 'textarea': {
      // Keep the author's line breaks; only trim the ends.
      const v = form.get(name)
      return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : ''
    }
    default:
      return formStr(form, name)
  }
}

// ------------------------------------------------------------ validation ----

/**
 * Problems keyed by the input name, so each message shows next to its field.
 * With `strict` off (a hidden block) only the format is checked, so a block
 * can be saved half written and switched on later.
 */
export function validateFields(fields: FieldDef[], data: FieldData, prefix: string, errors: Record<string, string>, strict = true) {
  for (const f of fields) {
    const name = prefix ? `${prefix}.${f.name}` : f.name
    const v = data[f.name]
    if (f.kind === 'list') {
      const rows = (v as ListRow[]) ?? []
      if (rows.length > f.max) errors[name] = `Hasta ${f.max} ${f.itemLabel.toLowerCase()}s.`
      if (strict && f.required && rows.length === 0) errors[name] = `Agregá al menos un ${f.itemLabel.toLowerCase()}.`
      for (const row of rows) validateFields(f.fields, row, `${name}.${row._id}`, errors, strict)
      continue
    }
    const problem = scalarProblem(strict ? f : { ...f, required: false }, v as ScalarValue)
    if (problem) errors[f.kind === 'focal' ? `${name}.x` : name] = problem
  }
}

function scalarProblem(f: ScalarField, v: ScalarValue): string | null {
  switch (f.kind) {
    case 'text':
    case 'textarea':
    case 'markdown': {
      const s = v as string
      if (f.required && !s) return 'Completá este campo.'
      const max = (f.kind !== 'markdown' && f.max) || DEFAULT_MAX[f.kind]
      if (s.length > max) return `Hasta ${max} caracteres (tiene ${s.length}).`
      return null
    }
    case 'link': {
      const s = v as string
      if (f.required && !s) return 'Completá el link.'
      return linkProblem(s)
    }
    case 'image':
      return f.required && !v ? 'Elegí una imagen.' : null
    case 'focal': {
      const { x, y } = v as Focal
      return [x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ? null : 'Usá valores de 0 a 100.'
    }
    case 'number': {
      const n = v as number
      return Number.isInteger(n) && n >= f.min && n <= f.max ? null : `Un número entero de ${f.min} a ${f.max}.`
    }
    case 'select':
      return f.options.some((o) => o.value === v) ? null : 'Elegí una opción.'
    case 'codes': {
      const codes = v as string[]
      if (f.required && !codes.length) return 'Escribí al menos un código.'
      if (f.max && codes.length > f.max) return `Hasta ${f.max} códigos.`
      const bad = codes.find((c) => !CODE_RE.test(c))
      return bad ? `"${bad}" no es un código válido: minúsculas, números y guiones.` : null
    }
    case 'boolean':
      return null
  }
}

/** Every string of a value tree passed through `fn` (copy variables, GEN-06). */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === '_id' ? v : mapStrings(v, fn)])) as T
  return value
}

/** JSON with sorted keys: the database reorders jsonb keys, so equality is checked on this. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}
