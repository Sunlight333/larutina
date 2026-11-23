// The product's editable texts and attributes ("Datos" in the panel), mapped
// to the template column each one comes from. Values are checked with the
// importer's own rules (parseCell, CAT-13, CAT-22), so the panel accepts
// what the import accepts and says it the same way.
import type { Prisma, Product, ProductLabel, ProductStatus } from '@prisma/client'
import { LISTS, type ListName } from '@/server/catalog-import/lists'
import { badBenefits, benefitsWarning, chipsProblems, CODE_RE, headlineProblem, parseCell } from '@/server/catalog-import/rules'
import { SHEETS, type Field } from '@/server/catalog-import/spec'

type Kind = 'text' | 'textarea' | 'int' | 'number' | 'lines' | 'list' | 'listOpt' | 'labels' | 'date' | 'brand' | 'category' | 'productRef' | 'skus'

export type DataField = {
  /** Prisma field name: also the key in Product.draft and the form field name. */
  name: keyof Product & string
  /** Template column (Productos), when the field is in the template. */
  key?: string
  label: string
  kind: Kind
  list?: ListName
  help?: string
  section: 'basico' | 'textos' | 'rutina' | 'ficha' | 'sellos' | 'tipo' | 'seo'
}

const d = (name: DataField['name'], key: string | undefined, label: string, kind: Kind, section: DataField['section'], extra: Partial<DataField> = {}): DataField => ({
  name,
  key,
  label,
  kind,
  section,
  ...extra,
})

export const DATA_FIELDS: DataField[] = [
  d('name', 'nombre', 'Nombre', 'text', 'basico'),
  d('brandId', 'marca', 'Marca', 'brand', 'basico'),
  d('categoryId', 'categoria', 'Categoría', 'category', 'basico', { help: 'La más específica.' }),
  d('line', 'linea', 'Línea', 'text', 'basico', { help: 'Línea de la marca: "De la misma línea" y el buscador (CAT-15).' }),
  d('headline', 'frase_principal', 'Frase principal', 'text', 'textos', { help: 'Hasta 8 palabras.' }),
  d('chips', 'chips', 'Chips', 'lines', 'textos', { help: 'Hasta 3, uno por línea, de hasta 20 caracteres. El tamaño, el paso y "Sin fragancia" salen solos.' }),
  d('shortDescription', 'descripcion_corta', 'Descripción corta', 'textarea', 'textos', { help: 'Una o dos oraciones para el listado.' }),
  d('description', 'descripcion', 'Descripción', 'textarea', 'textos'),
  d('benefits', 'beneficios', 'Beneficios', 'lines', 'textos', { help: 'Uno por línea, con el formato "VERBO: texto".' }),
  d('whyWeChose', 'por_que_lo_elegimos', 'Por qué lo elegimos', 'textarea', 'textos'),
  d('howToUse', 'modo_de_uso', 'Modo de uso', 'textarea', 'textos'),
  d('tips', 'tips', 'Tips', 'textarea', 'textos'),
  d('precautions', 'precauciones', 'Precauciones', 'textarea', 'textos', { help: 'Las propias del producto; las de familias y conflictos se agregan solas.' }),
  d('texture', 'textura', 'Textura', 'list', 'rutina', { list: 'textura' }),
  d('textureDescription', 'textura_descripcion', 'Descripción de la textura', 'textarea', 'rutina'),
  d('routineStep', 'paso_rutina', 'Paso de rutina', 'list', 'rutina', { list: 'paso' }),
  d('moment', 'momento', 'Momento', 'list', 'rutina', { list: 'momento' }),
  d('level', 'nivel', 'Nivel', 'listOpt', 'rutina', { list: 'nivel' }),
  d('durationDays', 'duracion_dias', 'Duración (días)', 'int', 'rutina', { help: 'Para las variantes que no tienen la suya.' }),
  d('priority', 'prioridad', 'Prioridad', 'int', 'rutina', { help: '1 = más prioritario. Desempata en el diagnóstico y ordena "Recomendados".' }),
  d('manualOrder', undefined, 'Orden manual', 'int', 'rutina', { help: 'En "Recomendados", después de la prioridad.' }),
  d('evaluationScore', 'evaluacion_puntaje', 'Evaluación (0 a 100)', 'int', 'ficha', { help: 'No se publica hasta tener el método.' }),
  d('evaluationNotes', 'evaluacion_notas', 'Notas de la evaluación', 'textarea', 'ficha'),
  d('labels', 'etiquetas', 'Etiquetas', 'labels', 'ficha', { list: 'etiqueta' }),
  d('anmatRegistration', 'anmat_registro', 'Registro ANMAT', 'text', 'ficha'),
  d('importerHolder', 'titular_importador', 'Titular o importador', 'text', 'ficha', { help: 'Como figura en el rótulo.' }),
  d('countryOfOrigin', 'pais_origen', 'País de origen', 'text', 'ficha', { help: 'Vacío: el de la marca.' }),
  d('paoMonths', 'pao_meses', 'PAO (meses)', 'int', 'ficha', { help: 'Meses de uso después de abierto.' }),
  d('vatRate', 'alicuota_iva', 'Alícuota de IVA (%)', 'number', 'ficha', { help: 'Solo si es distinta de la general.' }),
  d('presaleDate', undefined, 'Fecha de llegada (preventa)', 'date', 'ficha', { help: 'Con fecha, "Publicar" lo deja en Preventa.' }),
  d('vegan', 'vegano', 'Vegano', 'list', 'sellos', { list: 'si_no_sindato' }),
  d('crueltyFree', 'cruelty_free', 'Cruelty free', 'list', 'sellos', { list: 'si_no_sindato' }),
  d('dermatologistTested', 'testeado_dermatologicamente', 'Testeado dermatológicamente', 'list', 'sellos', { list: 'si_no_sindato' }),
  d('sealSource', 'fuente_sellos', 'Fuente de los sellos', 'text', 'sellos', { help: 'Interno: no se publica.' }),
  d('type', 'tipo', 'Tipo', 'list', 'tipo', { list: 'tipo_producto', help: 'El diagnóstico y las rutinas usan solo "Producto".' }),
  d('baseProductId', 'producto_base', 'Producto base', 'productRef', 'tipo', { help: 'Solo tamaño de viaje: código del producto de tamaño completo.' }),
  d('kitContents', 'contenido_kit', 'Contenido del kit', 'skus', 'tipo', { help: 'Solo kit: un SKU por línea.' }),
  d('seoTitle', 'seo_titulo', 'Título SEO', 'text', 'seo', { help: 'Vacío: se genera solo.' }),
  d('seoDescription', 'seo_descripcion', 'Descripción SEO', 'textarea', 'seo', { help: 'Vacía: se genera sola.' }),
]

export const SECTIONS: Record<DataField['section'], string> = {
  basico: 'Básico',
  textos: 'Textos de la ficha',
  rutina: 'Rutina y orden',
  ficha: 'Información del producto',
  sellos: 'Sellos',
  tipo: 'Tipo de producto',
  seo: 'SEO',
}

/** JSON-safe values of the "Datos" fields: the shape stored in Product.draft (ADM-02). */
export type DataValues = Record<string, string | number | string[] | null>

const templateField = (key: string | undefined): Field | undefined => (key ? SHEETS.Productos.fields.find((f) => f.key === key) : undefined)

/** The column values of the "Datos" fields, in draft shape (dates as YYYY-MM-DD, decimals as numbers). */
export function dataOf(p: Product): DataValues {
  const out: DataValues = {}
  for (const f of DATA_FIELDS) {
    const v = p[f.name] as unknown
    if (v instanceof Date) out[f.name] = v.toISOString().slice(0, 10)
    else if (v !== null && typeof v === 'object' && !Array.isArray(v)) out[f.name] = Number(v as Prisma.Decimal)
    else out[f.name] = v as string | number | string[] | null
  }
  return out
}

/** Draft values for Prisma: dates back to Date. Unknown keys are dropped. */
export function toPrismaData(values: DataValues): Prisma.ProductUncheckedUpdateInput {
  const data: Record<string, unknown> = {}
  for (const f of DATA_FIELDS) {
    if (!(f.name in values)) continue
    const v = values[f.name]
    data[f.name] = f.kind === 'date' ? (v ? new Date(`${v}T00:00:00Z`) : null) : v
  }
  return data as Prisma.ProductUncheckedUpdateInput
}

/** The draft as stored, keeping only known fields. */
export function readDraft(draft: Prisma.JsonValue | null): DataValues | null {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
  const known = new Set(DATA_FIELDS.map((f) => f.name as string))
  const out: DataValues = {}
  for (const [k, v] of Object.entries(draft)) if (known.has(k)) out[k] = v as DataValues[string]
  return Object.keys(out).length ? out : null
}

export type DataInput = Record<string, string | string[]>
export type Lookups = {
  brands: Map<string, string> // id → code, live brands
  categories: Map<string, string>
  productIdByCode: Map<string, { id: string; type: string }>
  skus: Set<string>
  dermatologistLabelEnabled: boolean
}

const one = (input: DataInput, name: string) => {
  const v = input[name]
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
}
const many = (input: DataInput, name: string) => {
  const v = input[name]
  return Array.isArray(v) ? v : v ? [v] : []
}
const linesOf = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * Reads and checks the "Datos" form. Required fields are those the template
 * requires from the first sample (S1); the S5 ones show in completeness.
 */
export function parseData(input: DataInput, current: Pick<Product, 'id' | 'labels'> | null, lookups: Lookups): { values: DataValues; errors: Record<string, string>; warnings: string[] } {
  const values: DataValues = {}
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  for (const f of DATA_FIELDS) {
    const tf = templateField(f.key)
    const required = tf?.req === 'S1'
    const raw = one(input, f.name)
    const fail = (message: string) => {
      errors[f.name] ??= message
    }
    switch (f.kind) {
      case 'text':
      case 'textarea':
      case 'int':
      case 'number': {
        if (raw === '') {
          if (required) fail('Campo obligatorio.')
          values[f.name] = null
          break
        }
        if (!tf) {
          // Fields outside the template: whole numbers from 1.
          const n = Number(raw)
          if (!Number.isInteger(n) || n < 1) fail(`"${raw}" tiene que ser un número entero mayor que 0.`)
          else values[f.name] = n
          break
        }
        const parsed = parseCell(tf, raw)
        if (!parsed.ok) fail(parsed.message)
        else values[f.name] = parsed.value as string | number
        break
      }
      case 'lines': {
        const list = linesOf(raw)
        const sep = f.name === 'benefits' || f.name === 'chips' ? '|' : ';'
        if (list.some((l) => l.includes(sep))) fail(`Cada ítem va en su propia línea, sin "${sep}".`)
        if (required && !list.length) fail('Campo obligatorio.')
        values[f.name] = list
        break
      }
      case 'skus': {
        const list = linesOf(raw)
        const unknown = list.filter((s) => !lookups.skus.has(s))
        if (unknown.length) fail(`No existen: ${unknown.join(', ')}.`)
        values[f.name] = list
        break
      }
      case 'list':
      case 'listOpt': {
        const allowed = LISTS[f.list!].labels.map(([, v]) => v as string)
        if (raw === '') {
          if (f.kind === 'list') fail('Elegí un valor.')
          values[f.name] = null
        } else if (!allowed.includes(raw)) fail('Elegí un valor de la lista.')
        else values[f.name] = raw
        break
      }
      case 'labels': {
        const allowed = LISTS.etiqueta.labels.map(([, v]) => v as string)
        let chosen = many(input, f.name).filter((v) => allowed.includes(v)) as ProductLabel[]
        // CAT-12: the dermatologist label stays locked until switched on; an
        // imported one is kept as it is.
        if (!lookups.dermatologistLabelEnabled) {
          chosen = chosen.filter((l) => l !== 'DERMATOLOGIST_RECOMMENDED')
          if (current?.labels.includes('DERMATOLOGIST_RECOMMENDED')) chosen.push('DERMATOLOGIST_RECOMMENDED')
        }
        values[f.name] = allowed.filter((l) => chosen.includes(l as ProductLabel))
        break
      }
      case 'date': {
        if (raw === '') values[f.name] = null
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) fail('Fecha no válida.')
        else values[f.name] = raw
        break
      }
      case 'brand':
        if (!lookups.brands.has(raw)) fail('Elegí una marca.')
        else values[f.name] = raw
        break
      case 'category':
        if (!lookups.categories.has(raw)) fail('Elegí una categoría.')
        else values[f.name] = raw
        break
      case 'productRef': {
        if (raw === '') {
          values[f.name] = null
          break
        }
        if (!CODE_RE.test(raw)) {
          fail('Escribí el código del producto (minúsculas, números y guiones).')
          break
        }
        const target = lookups.productIdByCode.get(raw)
        if (!target) fail(`El producto "${raw}" no existe.`)
        else if (target.id === current?.id) fail('Un producto no puede ser su propio producto base.')
        else values[f.name] = target.id
        break
      }
    }
  }

  const headline = headlineProblem(values.headline as string | null)
  if (headline) errors.headline ??= headline
  const chips = chipsProblems((values.chips as string[] | undefined) ?? [])
  if (chips.length) errors.chips ??= chips.join(' ')
  const wrong = badBenefits((values.benefits as string[] | undefined) ?? [])
  if (wrong.length) warnings.push(`Beneficios: ${benefitsWarning(wrong)}`)

  // Type rules, as in the import (CAT-07).
  if (values.type === 'TRAVEL_SIZE' && !values.baseProductId) errors.baseProductId ??= 'Un tamaño de viaje necesita el código de su producto de tamaño completo.'
  if (values.type !== 'TRAVEL_SIZE') values.baseProductId = null
  if (values.type === 'KIT' && !(values.kitContents as string[] | undefined)?.length) errors.kitContents ??= 'Un kit necesita la lista de SKU que incluye.'
  if (values.type !== 'KIT') values.kitContents = []
  return { values, errors, warnings }
}

/** Only the entries of `next` that differ from `base`. */
export function diffValues(base: DataValues, next: DataValues): DataValues {
  const out: DataValues = {}
  for (const [k, v] of Object.entries(next)) if (JSON.stringify(base[k] ?? null) !== JSON.stringify(v ?? null)) out[k] = v
  return out
}

/** The status "Publicar" sets for a product in draft: Preventa when it has an arrival date. */
export const publishedStatus = (presaleDate: string | Date | null | undefined): ProductStatus => (presaleDate ? 'PRESALE' : 'ACTIVE')
