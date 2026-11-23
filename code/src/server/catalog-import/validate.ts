// Turns a workbook into a checked catalog, without touching the database.
// Every problem is reported with sheet, row and column, in Spanish, because
// the report is what LaRutina's team reads in the panel (CAT-02). Errors stop
// the whole import; warnings and notes never do.
import type {
  Aptitude,
  ConflictSeverity,
  EndorsementTarget,
  ExperienceLevel,
  KnowledgeCategory,
  Moment,
  ProductLabel,
  ProductStatus,
  ProductType,
  RoutineDifficulty,
  RoutineStepType,
  SealValue,
  SynonymType,
  Unit,
} from '@prisma/client'
import { inciKey } from './inci'
import { buildIngredientList, computeFlags, defaultFlags, FLAG_COLUMNS, fragranceMismatch, inciMatcher, type ProductFlags } from './ingredient-list'
import { badBenefits, benefitsWarning, chipsProblems, headlineProblem, parseCell, promoProblem, type CellValue } from './rules'
import { SHEETS, type Field, type SheetName, type SheetSpec } from './spec'
import type { SheetRow, Workbook } from './workbook'

export type Stage = 'S1' | 'S5'
export type IssueLevel = 'error' | 'warning' | 'info'
export type Issue = { level: IssueLevel; sheet: string; row?: number; field?: string; message: string }

/** What the database already holds, so a file can reference it and updates can be compared. */
export type Existing = {
  brands: Set<string>
  categories: Set<string>
  concerns: Set<string>
  skinTypes: Set<string>
  families: Map<string, { computes: string[] }>
  ingredients: Map<string, { inciKey: string; familyCode: string | null }>
  products: Set<string>
  variants: Map<string, { priceCents: number; productCode: string }>
  routines: Set<string>
  criteria: Set<string>
}

export const emptyExisting = (): Existing => ({
  brands: new Set(),
  categories: new Set(),
  concerns: new Set(),
  skinTypes: new Set(),
  families: new Map(),
  ingredients: new Map(),
  products: new Set(),
  variants: new Map(),
  routines: new Set(),
  criteria: new Set(),
})

// ------------------------------------------------------------------ output ----

export type BrandIn = { code: string; name: string; countryOfOrigin: string | null; description: string | null; logoFile: string | null }
export type CategoryIn = { code: string; name: string; parentCode: string | null; sortOrder: number | null; description: string | null }
export type ConcernIn = { code: string; name: string; shortLabel: string; shortDescription: string | null; editorialContent: string | null }
export type SkinTypeIn = { code: string; name: string; description: string | null }
export type FamilyIn = { code: string; name: string; warning: string | null; excludableInDiagnosis: boolean; noDuplicate: boolean; computes: string[] }
export type IngredientIn = {
  code: string
  commonName: string
  inciName: string
  inciKey: string
  isKeyActive: boolean
  isIrritant: boolean
  description: string | null
  concernCodes: string[]
  familyCode: string | null
  /** Created from an INCI list, not from the Ingredientes sheet: "nuevo · revisar". */
  fromInci: boolean
}
export type ConflictIn = { a: string; b: string; severity: ConflictSeverity; note: string | null }

export { FLAG_COLUMNS, type ProductFlags }

export type ProductIn = {
  code: string
  name: string
  brandCode: string
  categoryCode: string
  /** Status asked for in the file. New products land in Borrador regardless (03 §3). */
  requestedStatus: ProductStatus
  type: ProductType
  shortDescription: string
  description: string
  benefits: string[]
  whyWeChose: string
  evaluationScore: number | null
  evaluationNotes: string | null
  howToUse: string
  precautions: string | null
  texture: string
  textureDescription: string | null
  tips: string | null
  routineStep: RoutineStepType
  moment: Moment
  durationDays: number | null
  level: ExperienceLevel | null
  priority: number | null
  baseProductCode: string | null
  kitContents: string[]
  line: string | null
  headline: string | null
  chips: string[]
  labels: ProductLabel[]
  vegan: SealValue
  crueltyFree: SealValue
  dermatologistTested: SealValue
  sealSource: string | null
  anmatRegistration: string | null
  importerHolder: string | null
  countryOfOrigin: string | null
  paoMonths: number | null
  vatRate: number | null
  inciText: string | null
  images: string[]
  videoUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  fragranceFreeDeclared: boolean | null
  flags: ProductFlags
  relations: { kind: 'COMPATIBLE' | 'COMPLEMENTARY' | 'ALTERNATIVE'; codes: string[] }[]
  ingredients: { code: string; inciOrder: number; isStar: boolean; concentration: string | null }[]
  concerns: { code: string; relevance: number }[]
  skinTypes: { code: string; aptitude: Aptitude }[]
}

export type VariantIn = {
  sku: string
  productCode: string
  size: number
  unit: Unit
  priceCents: number
  promoPriceCents: number | null
  stock: number
  barcode: string | null
  weightGrams: number | null
  isMain: boolean
  durationDays: number | null
  heightCm: number | null
  widthCm: number | null
  lengthCm: number | null
  /** Undefined when the file has no cost column (an export without cost, CAT-20): costs stay as they are. */
  costCents: number | null | undefined
}

export type RoutineIn = {
  code: string
  name: string
  goal: string
  moment: Moment
  skinTypeCodes: string[]
  concernCodes: string[]
  difficulty: RoutineDifficulty | null
  discountPct: number | null
  description: string | null
  steps: {
    position: number
    moment: Moment
    stepType: RoutineStepType
    title: string
    mainProductCode: string
    alternativeCodes: string[]
    instruction: string | null
    frequency: string | null
    optional: boolean
  }[]
}

export type CatalogInput = {
  brands: BrandIn[]
  categories: CategoryIn[]
  concerns: ConcernIn[]
  skinTypes: SkinTypeIn[]
  families: FamilyIn[]
  ingredients: IngredientIn[]
  conflicts: ConflictIn[]
  familyConflicts: ConflictIn[]
  products: ProductIn[]
  variants: VariantIn[]
  routines: RoutineIn[]
  criteria: { code: string; name: string; weight: number; description: string | null }[]
  evaluations: { productCode: string; criterionCode: string; score: number; note: string | null }[]
  endorsements: { targetType: EndorsementTarget; targetCode: string; entity: string; detail: string | null; quote: string | null; image: string | null; active: boolean }[]
  knowledge: { code: string; category: KnowledgeCategory; question: string; answer: string; keywords: string[]; active: boolean }[]
  synonyms: { term: string; type: SynonymType; targetCode: string; variants: string[] }[]
}

export type ValidationResult = {
  input: CatalogInput
  issues: Issue[]
  /** Columns still empty that the full catalog (S5) requires, counted per column. */
  missing: { sheet: string; field: string; rows: number }[]
}

// --------------------------------------------------------- reading values ----

type Value = CellValue
type Row = { row: number; v: Record<string, Value> }

class Context {
  issues: Issue[] = []
  missing = new Map<string, { sheet: string; field: string; rows: number }>()
  constructor(readonly stage: Stage) {}

  add(level: IssueLevel, sheet: string, row: number | undefined, field: string | undefined, message: string) {
    this.issues.push({ level, sheet, row, field, message })
  }
  error(sheet: string, row: number | undefined, field: string | undefined, message: string) {
    this.add('error', sheet, row, field, message)
  }
  warn(sheet: string, row: number | undefined, field: string | undefined, message: string) {
    this.add('warning', sheet, row, field, message)
  }
  info(sheet: string, row: number | undefined, field: string | undefined, message: string) {
    this.add('info', sheet, row, field, message)
  }
  countMissing(sheet: string, field: string) {
    const key = `${sheet}\u0000${field}`
    const entry = this.missing.get(key) ?? { sheet, field, rows: 0 }
    entry.rows++
    this.missing.set(key, entry)
  }
}

function readValue(ctx: Context, sheet: string, rowNum: number, field: Field, raw: string): Value {
  const parsed = parseCell(field, raw)
  if (parsed.ok) return parsed.value
  ctx.error(sheet, rowNum, field.key, parsed.message)
  return null
}

/** Reads one sheet: column checks, then every row's values with type and requirement checks. */
function readSheet(ctx: Context, wb: Workbook, spec: SheetSpec): Row[] {
  const sheet = wb.get(spec.name)
  if (!sheet) {
    if (spec.optionalSheet) ctx.info(spec.name, undefined, undefined, 'La hoja no está en el archivo; se toma como vacía.')
    else ctx.error(spec.name, undefined, undefined, 'Falta la hoja en el archivo. Usá la plantilla v1.1 sin cambiar los nombres de las hojas.')
    return []
  }
  const known = new Set(spec.fields.map((x) => x.key))
  for (const h of sheet.headers) {
    if (!known.has(h)) ctx.warn(spec.name, 1, h, 'Columna que la plantilla no tiene; se ignora.')
  }
  const present = new Set(sheet.headers)
  const fields = spec.fields.filter((field) => {
    if (present.has(field.key)) return true
    if (field.req === 'S1' || field.req === 'row' || (field.req === 'S5' && ctx.stage === 'S5'))
      ctx.error(spec.name, 1, field.key, 'Falta la columna. Usá la plantilla v1.1 sin borrar ni renombrar columnas.')
    else if (field.keepWhenAbsent) ctx.info(spec.name, 1, field.key, 'El archivo no tiene esta columna: los valores cargados no cambian.')
    else if (sheet.rows.length) ctx.warn(spec.name, 1, field.key, 'Falta la columna; se toma como vacía.')
    return false
  })

  return sheet.rows.map((r: SheetRow) => {
    const v: Record<string, Value> = {}
    for (const field of spec.fields) v[field.key] = null
    for (const field of fields) {
      const raw = r.cells[field.key] ?? ''
      if (raw === '') {
        const required = field.req === 'S1' || field.req === 'row' || (field.req === 'S5' && ctx.stage === 'S5')
        if (required) ctx.error(spec.name, r.row, field.key, 'Campo obligatorio vacío.')
        else if (field.req === 'S5') ctx.countMissing(spec.name, field.key)
        v[field.key] = field.type === 'refs' || field.type === 'texts' || field.type === 'pipes' || field.type === 'multi' ? [] : null
        continue
      }
      v[field.key] = readValue(ctx, spec.name, r.row, field, raw)
    }
    return { row: r.row, v }
  })
}

// Typed accessors over a row's values.
const str = (r: Row, k: string) => (r.v[k] as string | null) ?? null
const reqStr = (r: Row, k: string) => (r.v[k] as string | null) ?? ''
const num = (r: Row, k: string) => (r.v[k] as number | null) ?? null
const bool = (r: Row, k: string) => (r.v[k] as boolean | null) ?? null
const arr = (r: Row, k: string) => (r.v[k] as string[] | null) ?? []
const listVal = <T>(r: Row, k: string) => (r.v[k] as T | null) ?? null

// ------------------------------------------------------------ validation ----

/** Rows whose key repeats an earlier row are reported and dropped. */
function unique(ctx: Context, sheet: string, rows: Row[], key: (r: Row) => string | null, field: string, what: string): Row[] {
  const seen = new Map<string, number>()
  return rows.filter((r) => {
    const k = key(r)
    if (k === null) return false
    const first = seen.get(k)
    if (first !== undefined) {
      ctx.error(sheet, r.row, field, `${what} repetido: ya está en la fila ${first}.`)
      return false
    }
    seen.set(k, r.row)
    return true
  })
}

const sameStep = (a: RoutineStepType, b: RoutineStepType) => a === b

export type ValidateOptions = {
  /** For a role without access to cost (CAT-20): the cost column is ignored and costs stay as they are. */
  ignoreCost?: boolean
}

export function validateCatalog(wb: Workbook, existing: Existing = emptyExisting(), stage: Stage = 'S1', options: ValidateOptions = {}): ValidationResult {
  const ctx = new Context(stage)
  const read = (name: SheetName) => readSheet(ctx, wb, SHEETS[name])
  const hasCost = !options.ignoreCost && (wb.get('Variantes')?.headers.includes('costo_ars') ?? false)
  if (options.ignoreCost && wb.get('Variantes')?.headers.includes('costo_ars'))
    ctx.info('Variantes', 1, 'costo_ars', 'Tu rol no carga costos: la columna se ignora y los costos cargados no cambian.')

  // ---- taxonomies
  const brandRows = unique(ctx, 'Marcas', read('Marcas'), (r) => str(r, 'codigo_marca'), 'codigo_marca', 'Código de marca')
  const categoryRows = unique(ctx, 'Categorias', read('Categorias'), (r) => str(r, 'codigo_categoria'), 'codigo_categoria', 'Código de categoría')
  const concernRows = unique(ctx, 'Necesidades', read('Necesidades'), (r) => str(r, 'codigo_necesidad'), 'codigo_necesidad', 'Código de necesidad')
  const skinRows = unique(ctx, 'TiposDePiel', read('TiposDePiel'), (r) => str(r, 'codigo_tipo_piel'), 'codigo_tipo_piel', 'Código de tipo de piel')
  const familyRows = unique(ctx, 'Familias', read('Familias'), (r) => str(r, 'codigo_familia'), 'codigo_familia', 'Código de familia')
  const ingredientRows = unique(ctx, 'Ingredientes', read('Ingredientes'), (r) => str(r, 'codigo_ingrediente'), 'codigo_ingrediente', 'Código de ingrediente')

  const known = {
    brands: new Set([...existing.brands, ...brandRows.map((r) => reqStr(r, 'codigo_marca'))]),
    categories: new Set([...existing.categories, ...categoryRows.map((r) => reqStr(r, 'codigo_categoria'))]),
    concerns: new Set([...existing.concerns, ...concernRows.map((r) => reqStr(r, 'codigo_necesidad'))]),
    skinTypes: new Set([...existing.skinTypes, ...skinRows.map((r) => reqStr(r, 'codigo_tipo_piel'))]),
    families: new Set([...existing.families.keys(), ...familyRows.map((r) => reqStr(r, 'codigo_familia'))]),
    ingredients: new Set([...existing.ingredients.keys(), ...ingredientRows.map((r) => reqStr(r, 'codigo_ingrediente'))]),
  }
  const mustExist = (set: Set<string>, sheet: string, row: number, field: string, code: string | null, what: string) => {
    if (code !== null && !set.has(code)) {
      ctx.error(sheet, row, field, `${what} "${code}" no existe. Cargalo en su hoja o corregí el código.`)
      return false
    }
    return code !== null
  }

  const brands: BrandIn[] = brandRows.map((r) => ({
    code: reqStr(r, 'codigo_marca'),
    name: reqStr(r, 'nombre'),
    countryOfOrigin: str(r, 'pais_origen'),
    description: str(r, 'descripcion'),
    logoFile: str(r, 'logo_archivo'),
  }))

  const categories: CategoryIn[] = categoryRows.map((r) => {
    const parent = str(r, 'categoria_padre')
    if (parent === reqStr(r, 'codigo_categoria')) ctx.error('Categorias', r.row, 'categoria_padre', 'Una categoría no puede ser su propia categoría padre.')
    else mustExist(known.categories, 'Categorias', r.row, 'categoria_padre', parent, 'La categoría')
    return { code: reqStr(r, 'codigo_categoria'), name: reqStr(r, 'nombre'), parentCode: parent, sortOrder: num(r, 'orden'), description: str(r, 'descripcion') }
  })

  const concerns: ConcernIn[] = concernRows.map((r) => ({
    code: reqStr(r, 'codigo_necesidad'),
    name: reqStr(r, 'nombre'),
    shortLabel: reqStr(r, 'etiqueta_corta'),
    shortDescription: str(r, 'descripcion_corta'),
    editorialContent: str(r, 'contenido_editorial'),
  }))

  const skinTypes: SkinTypeIn[] = skinRows.map((r) => ({ code: reqStr(r, 'codigo_tipo_piel'), name: reqStr(r, 'nombre'), description: str(r, 'descripcion') }))

  const KNOWN_FLAGS = new Set(Object.keys(FLAG_COLUMNS))
  const families: FamilyIn[] = familyRows.map((r) => {
    const computes = arr(r, 'calcula')
    for (const flag of computes)
      if (!KNOWN_FLAGS.has(flag)) ctx.warn('Familias', r.row, 'calcula', `"${flag}" no es un indicador que la plataforma calcule; se ignora.`)
    return {
      code: reqStr(r, 'codigo_familia'),
      name: reqStr(r, 'nombre'),
      warning: str(r, 'advertencia'),
      excludableInDiagnosis: bool(r, 'excluible_en_diagnostico') ?? false,
      noDuplicate: bool(r, 'no_duplicar') ?? false,
      computes: computes.filter((c) => KNOWN_FLAGS.has(c)),
    }
  })
  const familyComputes = new Map<string, string[]>([...existing.families].map(([code, f]) => [code, f.computes]))
  for (const fam of families) familyComputes.set(fam.code, fam.computes)

  const ingredients: IngredientIn[] = ingredientRows.map((r) => {
    const isKeyActive = bool(r, 'es_activo_clave') ?? false
    if (isKeyActive && !str(r, 'descripcion')) {
      if (stage === 'S5') ctx.error('Ingredientes', r.row, 'descripcion', 'Los ingredientes estrella (es_activo_clave = Sí) necesitan descripción en el catálogo completo.')
      else ctx.countMissing('Ingredientes', 'descripcion (activos clave)')
    }
    const concernCodes = arr(r, 'necesidades').filter((c) => mustExist(known.concerns, 'Ingredientes', r.row, 'necesidades', c, 'La necesidad'))
    const familyCode = str(r, 'familia')
    mustExist(known.families, 'Ingredientes', r.row, 'familia', familyCode, 'La familia')
    return {
      code: reqStr(r, 'codigo_ingrediente'),
      commonName: reqStr(r, 'nombre_comun'),
      inciName: reqStr(r, 'nombre_inci'),
      inciKey: inciKey(reqStr(r, 'nombre_inci')),
      isKeyActive,
      isIrritant: bool(r, 'es_irritante') ?? false,
      description: str(r, 'descripcion'),
      concernCodes,
      familyCode: familyCode && known.families.has(familyCode) ? familyCode : null,
      fromInci: false,
    }
  })

  // INCI name → ingredient code, from the database first and the file on top.
  const byInci = new Map<string, string>()
  for (const [code, ing] of existing.ingredients) byInci.set(ing.inciKey, code)
  const ingredientRowByCode = new Map(ingredientRows.map((r) => [reqStr(r, 'codigo_ingrediente'), r.row]))
  for (const ing of ingredients) {
    const other = byInci.get(ing.inciKey)
    if (other && other !== ing.code && ingredientRowByCode.has(other))
      ctx.warn('Ingredientes', ingredientRowByCode.get(ing.code), 'nombre_inci', `Mismo nombre INCI que "${other}". Las listas INCI se asocian a "${other}".`)
    else byInci.set(ing.inciKey, ing.code)
  }
  const ingredientFamily = new Map<string, string | null>([...existing.ingredients].map(([code, i]) => [code, i.familyCode]))
  for (const ing of ingredients) ingredientFamily.set(ing.code, ing.familyCode)

  // ---- conflicts
  const conflictPairs = (
    sheet: 'Conflictos' | 'Conflictos_Familias',
    fa: string,
    fb: string,
    set: Set<string>,
    what: string,
  ): ConflictIn[] => {
    const seen = new Map<string, number>()
    const out: ConflictIn[] = []
    for (const r of read(sheet)) {
      const a = str(r, fa)
      const b = str(r, fb)
      const okA = mustExist(set, sheet, r.row, fa, a, what)
      const okB = mustExist(set, sheet, r.row, fb, b, what)
      if (!okA || !okB) continue
      if (a === b) {
        ctx.error(sheet, r.row, fb, 'Un conflicto necesita dos elementos distintos.')
        continue
      }
      const key = [a, b].sort().join('|')
      if (seen.has(key)) {
        ctx.error(sheet, r.row, fa, `Este par ya está en la fila ${seen.get(key)}.`)
        continue
      }
      seen.set(key, r.row)
      const severity = listVal<ConflictSeverity>(r, 'severidad')
      if (severity) out.push({ a: a!, b: b!, severity, note: str(r, 'nota') })
    }
    return out
  }
  const conflicts = conflictPairs('Conflictos', 'ingrediente_a', 'ingrediente_b', known.ingredients, 'El ingrediente')
  const familyConflicts = conflictPairs('Conflictos_Familias', 'familia_a', 'familia_b', known.families, 'La familia')

  // ---- products and variants
  const productRows = unique(ctx, 'Productos', read('Productos'), (r) => str(r, 'codigo_producto'), 'codigo_producto', 'Código de producto')
  const variantRows = unique(ctx, 'Variantes', read('Variantes'), (r) => str(r, 'sku'), 'sku', 'SKU')
  const productCodes = new Set([...existing.products, ...productRows.map((r) => reqStr(r, 'codigo_producto'))])
  const productStep = new Map(productRows.map((r) => [reqStr(r, 'codigo_producto'), listVal<RoutineStepType>(r, 'paso_rutina')]))
  const productType = new Map(productRows.map((r) => [reqStr(r, 'codigo_producto'), listVal<ProductType>(r, 'tipo') ?? 'PRODUCT']))
  const allSkus = new Set([...existing.variants.keys(), ...variantRows.map((r) => reqStr(r, 'sku'))])

  const products: ProductIn[] = []
  const productByCode = new Map<string, ProductIn>()
  for (const r of productRows) {
    const code = reqStr(r, 'codigo_producto')
    const S = 'Productos'
    mustExist(known.brands, S, r.row, 'marca', str(r, 'marca'), 'La marca')
    mustExist(known.categories, S, r.row, 'categoria', str(r, 'categoria'), 'La categoría')

    const type = productType.get(code)!
    const base = str(r, 'producto_base')
    if (type === 'TRAVEL_SIZE' && !base) ctx.error(S, r.row, 'producto_base', 'Un tamaño de viaje necesita el código de su producto de tamaño completo.')
    if (base) {
      if (type !== 'TRAVEL_SIZE') ctx.warn(S, r.row, 'producto_base', 'Solo se usa en productos de tipo "Tamaño de viaje"; se ignora.')
      else if (base === code) ctx.error(S, r.row, 'producto_base', 'Un producto no puede ser su propio producto base.')
      else mustExist(productCodes, S, r.row, 'producto_base', base, 'El producto')
    }
    const kit = arr(r, 'contenido_kit')
    if (kit.length && type !== 'KIT') ctx.warn(S, r.row, 'contenido_kit', 'Solo se usa en productos de tipo "Kit"; se ignora.')
    if (type === 'KIT') {
      if (!kit.length) ctx.error(S, r.row, 'contenido_kit', 'Un kit necesita la lista de SKU que incluye.')
      for (const sku of kit) if (!allSkus.has(sku)) ctx.error(S, r.row, 'contenido_kit', `El SKU "${sku}" no existe en Variantes.`)
    }

    const headline = str(r, 'frase_principal')
    const headlineError = headlineProblem(headline)
    if (headlineError) ctx.error(S, r.row, 'frase_principal', headlineError)
    const chips = arr(r, 'chips')
    for (const message of chipsProblems(chips)) ctx.error(S, r.row, 'chips', message)
    const benefits = arr(r, 'beneficios')
    const wrongBenefits = badBenefits(benefits)
    if (wrongBenefits.length) ctx.warn(S, r.row, 'beneficios', benefitsWarning(wrongBenefits))

    const relations: ProductIn['relations'] = []
    for (const [field, kind] of [
      ['compatibles', 'COMPATIBLE'],
      ['complementarios', 'COMPLEMENTARY'],
      ['alternativas', 'ALTERNATIVE'],
    ] as const) {
      const codes = arr(r, field).filter((c) => {
        if (c === code) {
          ctx.error(S, r.row, field, 'Un producto no puede relacionarse consigo mismo.')
          return false
        }
        return mustExist(productCodes, S, r.row, field, c, 'El producto')
      })
      if (codes.length) relations.push({ kind, codes: [...new Set(codes)] })
    }

    const product: ProductIn = {
      code,
      name: reqStr(r, 'nombre'),
      brandCode: reqStr(r, 'marca'),
      categoryCode: reqStr(r, 'categoria'),
      requestedStatus: listVal<ProductStatus>(r, 'estado') ?? 'DRAFT',
      type,
      shortDescription: reqStr(r, 'descripcion_corta'),
      description: reqStr(r, 'descripcion'),
      benefits,
      whyWeChose: reqStr(r, 'por_que_lo_elegimos'),
      evaluationScore: num(r, 'evaluacion_puntaje'),
      evaluationNotes: str(r, 'evaluacion_notas'),
      howToUse: reqStr(r, 'modo_de_uso'),
      precautions: str(r, 'precauciones'),
      texture: listVal<string>(r, 'textura') ?? '',
      textureDescription: str(r, 'textura_descripcion'),
      tips: str(r, 'tips'),
      routineStep: listVal<RoutineStepType>(r, 'paso_rutina') ?? 'TREATMENT',
      moment: listVal<Moment>(r, 'momento') ?? 'BOTH',
      durationDays: num(r, 'duracion_dias'),
      level: listVal<ExperienceLevel>(r, 'nivel'),
      priority: num(r, 'prioridad'),
      baseProductCode: type === 'TRAVEL_SIZE' ? base : null,
      kitContents: type === 'KIT' ? kit : [],
      line: str(r, 'linea'),
      headline,
      chips,
      labels: [...new Set(arr(r, 'etiquetas') as ProductLabel[])],
      vegan: listVal<SealValue>(r, 'vegano') ?? 'UNKNOWN',
      crueltyFree: listVal<SealValue>(r, 'cruelty_free') ?? 'UNKNOWN',
      dermatologistTested: listVal<SealValue>(r, 'testeado_dermatologicamente') ?? 'UNKNOWN',
      sealSource: str(r, 'fuente_sellos'),
      anmatRegistration: str(r, 'anmat_registro'),
      importerHolder: str(r, 'titular_importador'),
      countryOfOrigin: str(r, 'pais_origen'),
      paoMonths: num(r, 'pao_meses'),
      vatRate: num(r, 'alicuota_iva'),
      inciText: str(r, 'inci'),
      images: arr(r, 'imagenes'),
      videoUrl: str(r, 'video_url'),
      seoTitle: str(r, 'seo_titulo'),
      seoDescription: str(r, 'seo_descripcion'),
      fragranceFreeDeclared: bool(r, 'sin_fragancia'),
      flags: defaultFlags(),
      relations,
      ingredients: [],
      concerns: [],
      skinTypes: [],
    }
    products.push(product)
    productByCode.set(code, product)
  }

  // Variants: prices to centavos; one main variant per product.
  const variants: VariantIn[] = []
  const variantsByProduct = new Map<string, { v: VariantIn; row: number }[]>()
  for (const r of variantRows) {
    const S = 'Variantes'
    const productCode = str(r, 'codigo_producto')
    if (!mustExist(productCodes, S, r.row, 'codigo_producto', productCode, 'El producto')) continue
    const price = num(r, 'precio_ars')
    const promo = num(r, 'precio_promocional_ars')
    const promoError = promoProblem(price, promo)
    if (promoError) ctx.error(S, r.row, 'precio_promocional_ars', promoError)
    const sku = reqStr(r, 'sku')
    const v: VariantIn = {
      sku,
      productCode: productCode!,
      size: num(r, 'tamano') ?? 0,
      unit: listVal<Unit>(r, 'unidad') ?? 'ML',
      priceCents: Math.round((price ?? 0) * 100),
      promoPriceCents: promo === null ? null : Math.round(promo * 100),
      stock: num(r, 'stock') ?? 0,
      barcode: str(r, 'codigo_barras'),
      weightGrams: num(r, 'peso_g'),
      isMain: bool(r, 'variante_principal') ?? false,
      durationDays: num(r, 'duracion_dias'),
      heightCm: num(r, 'alto_cm'),
      widthCm: num(r, 'ancho_cm'),
      lengthCm: num(r, 'largo_cm'),
      costCents: !hasCost ? undefined : num(r, 'costo_ars') === null ? null : Math.round(num(r, 'costo_ars')! * 100),
    }
    const before = existing.variants.get(sku)
    if (before && before.productCode !== v.productCode)
      ctx.error(S, r.row, 'codigo_producto', `El SKU ya pertenece al producto "${before.productCode}". Un SKU no cambia de producto.`)
    if (before && price !== null && before.priceCents !== v.priceCents) {
      const pct = before.priceCents ? Math.round(((v.priceCents - before.priceCents) / before.priceCents) * 100) : 0
      ctx.warn(S, r.row, 'precio_ars', `El precio cambia de ${before.priceCents / 100} a ${v.priceCents / 100} (${pct > 0 ? '+' : ''}${pct}%).`)
    }
    variants.push(v)
    const list = variantsByProduct.get(v.productCode) ?? []
    list.push({ v, row: r.row })
    variantsByProduct.set(v.productCode, list)
  }
  for (const p of products) {
    const list = variantsByProduct.get(p.code) ?? []
    const row = productRows.find((r) => reqStr(r, 'codigo_producto') === p.code)!.row
    if (!list.length && !existing.products.has(p.code)) {
      ctx.error('Productos', row, 'codigo_producto', 'El producto no tiene ninguna variante en la hoja Variantes.')
      continue
    }
    const [first, second] = list.filter((x) => x.v.isMain)
    const only = list.length === 1 ? list[0] : undefined
    if (first && second) ctx.error('Variantes', second.row, 'variante_principal', `El producto "${p.code}" ya tiene una variante principal (fila ${first.row}).`)
    else if (!first && only) {
      only.v.isMain = true
      ctx.info('Variantes', only.row, 'variante_principal', 'Única variante del producto: se toma como principal.')
    } else if (!first && list[0]) ctx.error('Variantes', list[0].row, 'variante_principal', `El producto "${p.code}" tiene varias variantes y ninguna marcada como principal.`)
  }

  // Product ingredients: the INCI list gives the full ordered list; the sheet
  // Prod_Ingredientes marks the star ingredients (and is the list itself when
  // a product has no INCI text).
  const piRows = read('Prod_Ingredientes')
  const piByProduct = new Map<string, Row[]>()
  for (const r of piRows) {
    const p = str(r, 'codigo_producto')
    const okP = mustExist(productCodes, 'Prod_Ingredientes', r.row, 'codigo_producto', p, 'El producto')
    const okI = mustExist(known.ingredients, 'Prod_Ingredientes', r.row, 'codigo_ingrediente', str(r, 'codigo_ingrediente'), 'El ingrediente')
    if (!okP || !okI) continue
    const list = piByProduct.get(p!) ?? []
    list.push(r)
    piByProduct.set(p!, list)
  }

  const usedCodes = new Set(known.ingredients)
  const matcher = inciMatcher(byInci, usedCodes)

  for (const p of products) {
    const row = productRows.find((r) => reqStr(r, 'codigo_producto') === p.code)!.row
    const highlights = (piByProduct.get(p.code) ?? []).map((r) => ({
      code: reqStr(r, 'codigo_ingrediente'),
      isStar: bool(r, 'es_activo_clave') ?? false,
      concentration: str(r, 'concentracion'),
      inciOrder: num(r, 'orden_inci'),
      source: r,
    }))
    const list = buildIngredientList(p.inciText, highlights, matcher.match, (issue) => {
      if (issue.kind === 'repeated-in-inci')
        ctx.warn('Productos', row, 'inci', `"${issue.name}" aparece dos veces en la lista INCI (o dos nombres son el mismo ingrediente); se toma la primera posición.`)
      else if (issue.kind === 'not-in-inci')
        ctx.warn('Prod_Ingredientes', issue.item.source.row, 'codigo_ingrediente', `"${issue.item.code}" no figura en la lista INCI del producto "${p.code}"; se agrega al final.`)
      else ctx.error('Prod_Ingredientes', issue.item.source.row, 'codigo_ingrediente', `El ingrediente ya está cargado para "${p.code}".`)
    })
    p.ingredients = list

    // Flags computed from the families of the ingredients (CAT-08).
    p.flags = computeFlags(
      list.map((i) => i.code),
      (code) => ingredientFamily.get(code),
      (fam) => familyComputes.get(fam),
    )
    const mismatch = fragranceMismatch(p.fragranceFreeDeclared, p.flags.fragranceFree)
    if (mismatch) ctx.warn('Productos', row, 'sin_fragancia', mismatch)
    if (p.type === 'PRODUCT' && list.length === 0) ctx.countMissing('Productos', 'inci (o Prod_Ingredientes)')
  }
  const createdFromInci = new Map<string, IngredientIn>(
    [...matcher.created.values()].map((i) => [i.code, { ...i, isKeyActive: false, isIrritant: false, description: null, concernCodes: [], familyCode: null, fromInci: true }]),
  )
  for (const ing of createdFromInci.values()) ctx.info('Ingredientes', undefined, ing.code, `Ingrediente nuevo desde una lista INCI: "${ing.inciName}". Queda para revisar.`)

  // Concerns and skin types per product.
  const pairRows = (sheet: 'Prod_Necesidades' | 'Prod_TiposPiel', field: string, set: Set<string>, what: string) => {
    const seen = new Map<string, number>()
    const out: Row[] = []
    for (const r of read(sheet)) {
      const p = str(r, 'codigo_producto')
      const c = str(r, field)
      const okP = mustExist(productCodes, sheet, r.row, 'codigo_producto', p, 'El producto')
      const okC = mustExist(set, sheet, r.row, field, c, what)
      if (!okP || !okC) continue
      const key = `${p}|${c}`
      if (seen.has(key)) {
        ctx.error(sheet, r.row, field, `Este par ya está en la fila ${seen.get(key)}.`)
        continue
      }
      seen.set(key, r.row)
      out.push(r)
    }
    return out
  }
  for (const r of pairRows('Prod_Necesidades', 'codigo_necesidad', known.concerns, 'La necesidad')) {
    const p = productByCode.get(reqStr(r, 'codigo_producto'))
    const relevance = num(r, 'relevancia')
    if (p && relevance !== null) p.concerns.push({ code: reqStr(r, 'codigo_necesidad'), relevance })
  }
  for (const r of pairRows('Prod_TiposPiel', 'codigo_tipo_piel', known.skinTypes, 'El tipo de piel')) {
    const p = productByCode.get(reqStr(r, 'codigo_producto'))
    const aptitude = listVal<Aptitude>(r, 'aptitud')
    if (p && aptitude) p.skinTypes.push({ code: reqStr(r, 'codigo_tipo_piel'), aptitude })
  }
  for (const p of products) {
    if (p.type !== 'PRODUCT') continue
    const row = productRows.find((r) => reqStr(r, 'codigo_producto') === p.code)!.row
    if (!p.concerns.length) ctx.warn('Productos', row, 'codigo_producto', 'El producto no tiene necesidades en Prod_Necesidades: el diagnóstico no lo va a recomendar.')
    if (!p.skinTypes.length) ctx.warn('Productos', row, 'codigo_producto', 'El producto no tiene tipos de piel en Prod_TiposPiel: el diagnóstico no lo va a recomendar.')
  }

  // ---- routines
  const routineRows = unique(ctx, 'Rutinas', read('Rutinas'), (r) => str(r, 'codigo_rutina'), 'codigo_rutina', 'Código de rutina')
  const routineCodes = new Set([...existing.routines, ...routineRows.map((r) => reqStr(r, 'codigo_rutina'))])
  const routines: RoutineIn[] = routineRows.map((r) => ({
    code: reqStr(r, 'codigo_rutina'),
    name: reqStr(r, 'nombre'),
    goal: reqStr(r, 'objetivo'),
    moment: listVal<Moment>(r, 'momento') ?? 'BOTH',
    skinTypeCodes: arr(r, 'tipos_piel').filter((c) => mustExist(known.skinTypes, 'Rutinas', r.row, 'tipos_piel', c, 'El tipo de piel')),
    concernCodes: arr(r, 'necesidades').filter((c) => mustExist(known.concerns, 'Rutinas', r.row, 'necesidades', c, 'La necesidad')),
    difficulty: listVal<RoutineDifficulty>(r, 'dificultad'),
    discountPct: num(r, 'descuento_pct'),
    description: str(r, 'descripcion'),
    steps: [],
  }))
  const routineByCode = new Map(routines.map((x) => [x.code, x]))
  const stepSeen = new Map<string, number>()
  for (const r of read('Pasos_Rutina')) {
    const S = 'Pasos_Rutina'
    const routineCode = str(r, 'codigo_rutina')
    if (!mustExist(routineCodes, S, r.row, 'codigo_rutina', routineCode, 'La rutina')) continue
    const routine = routineByCode.get(routineCode!)
    if (!routine) {
      ctx.error(S, r.row, 'codigo_rutina', `Los pasos de "${routineCode}" se cargan junto con la rutina, en la hoja Rutinas del mismo archivo.`)
      continue
    }
    const position = num(r, 'orden')
    const key = `${routineCode}|${position}`
    if (position !== null && stepSeen.has(key)) {
      ctx.error(S, r.row, 'orden', `La rutina ya tiene un paso ${position} (fila ${stepSeen.get(key)}).`)
      continue
    }
    if (position !== null) stepSeen.set(key, r.row)
    const main = str(r, 'producto_principal')
    if (!mustExist(productCodes, S, r.row, 'producto_principal', main, 'El producto')) continue
    const stepType = listVal<RoutineStepType>(r, 'tipo_paso')
    if (productType.has(main!) && productType.get(main!) !== 'PRODUCT')
      ctx.error(S, r.row, 'producto_principal', 'Las rutinas solo usan productos de tipo "Producto", no kits ni tamaños de viaje.')
    const alternatives = arr(r, 'alternativas').filter((c) => {
      if (c === main) {
        ctx.error(S, r.row, 'alternativas', 'La alternativa no puede ser el producto principal.')
        return false
      }
      return mustExist(productCodes, S, r.row, 'alternativas', c, 'El producto')
    })
    if (alternatives.length > 2) ctx.error(S, r.row, 'alternativas', `Tiene ${alternatives.length} alternativas; el máximo es 2.`)
    for (const c of [main!, ...alternatives]) {
      const step = productStep.get(c)
      if (step && stepType && !sameStep(step, stepType))
        ctx.warn(S, r.row, c === main ? 'producto_principal' : 'alternativas', `"${c}" está cargado como otro paso de rutina en Productos; las alternativas tienen que ser del mismo paso (CAT-22).`)
    }
    if (position === null || !stepType) continue
    routine.steps.push({
      position,
      moment: listVal<Moment>(r, 'momento') ?? routine.moment,
      stepType,
      title: reqStr(r, 'titulo'),
      mainProductCode: main!,
      alternativeCodes: alternatives.slice(0, 2),
      instruction: str(r, 'instruccion'),
      frequency: str(r, 'frecuencia'),
      optional: bool(r, 'opcional') ?? false,
    })
  }
  for (const routine of routines) {
    if (!routine.steps.length) ctx.warn('Rutinas', routineRows.find((r) => reqStr(r, 'codigo_rutina') === routine.code)?.row, 'codigo_rutina', 'La rutina no tiene pasos en Pasos_Rutina.')
    routine.steps.sort((a, b) => a.position - b.position)
  }

  // ---- evaluation, endorsements, knowledge base, synonyms
  const criteriaRows = unique(ctx, 'Criterios', read('Criterios'), (r) => str(r, 'codigo_criterio'), 'codigo_criterio', 'Código de criterio')
  const criteria = criteriaRows.map((r) => ({ code: reqStr(r, 'codigo_criterio'), name: reqStr(r, 'nombre'), weight: num(r, 'peso') ?? 0, description: str(r, 'descripcion') }))
  const criterionCodes = new Set([...existing.criteria, ...criteria.map((c) => c.code)])
  const evaluations: CatalogInput['evaluations'] = []
  const evalSeen = new Map<string, number>()
  for (const r of read('Evaluacion')) {
    const p = str(r, 'codigo_producto')
    const c = str(r, 'codigo_criterio')
    const okP = mustExist(productCodes, 'Evaluacion', r.row, 'codigo_producto', p, 'El producto')
    const okC = mustExist(criterionCodes, 'Evaluacion', r.row, 'codigo_criterio', c, 'El criterio')
    const score = num(r, 'puntaje')
    if (!okP || !okC || score === null) continue
    if (evalSeen.has(`${p}|${c}`)) {
      ctx.error('Evaluacion', r.row, 'codigo_criterio', `Este criterio ya está evaluado para el producto (fila ${evalSeen.get(`${p}|${c}`)}).`)
      continue
    }
    evalSeen.set(`${p}|${c}`, r.row)
    evaluations.push({ productCode: p!, criterionCode: c!, score, note: str(r, 'nota') })
  }

  const endorsements: CatalogInput['endorsements'] = []
  for (const r of read('Avales')) {
    const target = listVal<EndorsementTarget>(r, 'tipo')
    const code = str(r, 'codigo_producto')
    if (!target || !code) continue
    if (!mustExist(target === 'PRODUCT' ? productCodes : routineCodes, 'Avales', r.row, 'codigo_producto', code, target === 'PRODUCT' ? 'El producto' : 'La rutina')) continue
    endorsements.push({
      targetType: target,
      targetCode: code,
      entity: reqStr(r, 'entidad'),
      detail: str(r, 'detalle'),
      quote: str(r, 'cita'),
      image: str(r, 'imagen'),
      active: bool(r, 'activo') ?? false,
    })
  }

  const kbRows = unique(ctx, 'Base_Conocimiento', read('Base_Conocimiento'), (r) => str(r, 'codigo'), 'codigo', 'Código')
  const knowledge = kbRows.flatMap((r) => {
    const category = listVal<KnowledgeCategory>(r, 'categoria')
    if (!category) return []
    return [{ code: reqStr(r, 'codigo'), category, question: reqStr(r, 'pregunta'), answer: reqStr(r, 'respuesta'), keywords: arr(r, 'palabras_clave'), active: bool(r, 'activa') ?? true }]
  })

  const synonymTargets: Partial<Record<SynonymType, [Set<string>, string]>> = {
    SKIN_TYPE: [known.skinTypes, 'El tipo de piel'],
    CONCERN: [known.concerns, 'La necesidad'],
    PRODUCT_TYPE: [known.categories, 'La categoría'],
    BRAND: [known.brands, 'La marca'],
    INGREDIENT: [known.ingredients, 'El ingrediente'],
  }
  const synonyms: CatalogInput['synonyms'] = []
  const synSeen = new Map<string, number>()
  for (const r of read('Sinonimos')) {
    const type = listVal<SynonymType>(r, 'tipo')
    const target = str(r, 'codigo_destino')
    const term = str(r, 'termino')
    if (!type || !target || !term) continue
    const check = synonymTargets[type]
    if (check && !mustExist(check[0], 'Sinonimos', r.row, 'codigo_destino', target, check[1])) continue
    const key = `${type}|${target}|${term}`
    if (synSeen.has(key)) {
      ctx.error('Sinonimos', r.row, 'termino', `Ya está en la fila ${synSeen.get(key)}.`)
      continue
    }
    synSeen.set(key, r.row)
    synonyms.push({ term, type, targetCode: target, variants: arr(r, 'sinonimos') })
  }

  if (products.some((p) => p.requestedStatus !== 'DRAFT'))
    ctx.info('Productos', undefined, 'estado', 'Los productos nuevos quedan en Borrador y se publican desde el panel. Los que ya existían conservan su estado.')

  return {
    input: {
      brands,
      categories,
      concerns,
      skinTypes,
      families,
      ingredients: [...ingredients, ...createdFromInci.values()],
      conflicts,
      familyConflicts,
      products,
      variants,
      routines,
      criteria,
      evaluations,
      endorsements,
      knowledge,
      synonyms,
    },
    issues: ctx.issues,
    missing: [...ctx.missing.values()],
  }
}
