// The closed lists of template v1.1 (sheet Listas) and the schema value each
// label maps to. Matching ignores case and accents, so "Tonico" or "tónico"
// both read as "Tónico"; the export writes the canonical label back.
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

export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export type ListDef<T extends string = string> = { name: string; labels: readonly [string, T][] }

const list = <T extends string>(name: string, labels: [string, T][]): ListDef<T> => ({ name, labels })

export const LISTS = {
  estado: list<ProductStatus>('estado', [
    ['Borrador', 'DRAFT'],
    ['Activo', 'ACTIVE'],
    ['Preventa', 'PRESALE'],
    ['Agotado', 'SOLD_OUT'],
    ['Archivado', 'ARCHIVED'],
  ]),
  si_no: list<'true' | 'false'>('si_no', [
    ['Sí', 'true'],
    ['No', 'false'],
  ]),
  aptitud: list<Aptitude>('aptitud', [
    ['Ideal', 'IDEAL'],
    ['Apto', 'SUITABLE'],
    ['Con precaución', 'CAUTION'],
    ['No recomendado', 'NOT_RECOMMENDED'],
  ]),
  momento: list<Moment>('momento', [
    ['AM', 'AM'],
    ['PM', 'PM'],
    ['AM y PM', 'BOTH'],
  ]),
  paso: list<RoutineStepType>('paso', [
    ['Desmaquillante', 'MAKEUP_REMOVER'],
    ['Limpiador', 'CLEANSER'],
    ['Exfoliante', 'EXFOLIANT'],
    ['Tónico', 'TONER'],
    ['Esencia', 'ESSENCE'],
    ['Sérum', 'SERUM'],
    ['Contorno de ojos', 'EYE_CONTOUR'],
    ['Hidratante', 'MOISTURIZER'],
    ['Aceite', 'OIL'],
    ['Protector solar', 'SUNSCREEN'],
    ['Mascarilla', 'MASK'],
    ['Tratamiento', 'TREATMENT'],
  ]),
  // Textures are stored as their label: the list grows (Mochi and Pasta came in v1.1).
  textura: list<string>(
    'textura',
    ['Gel', 'Crema', 'Loción', 'Fluido', 'Aceite', 'Bálsamo', 'Espuma', 'Agua', 'Polvo', 'Parche', 'Mochi', 'Pasta'].map((t) => [t, t]),
  ),
  unidad: list<Unit>('unidad', [
    ['ml', 'ML'],
    ['g', 'G'],
    ['unidades', 'UNITS'],
  ]),
  severidad: list<ConflictSeverity>('severidad', [
    ['Evitar', 'AVOID'],
    ['Con precaución', 'CAUTION'],
    ['Días alternos', 'ALTERNATE_DAYS'],
  ]),
  dificultad: list<RoutineDifficulty>('dificultad', [
    ['Básica', 'BASIC'],
    ['Intermedia', 'INTERMEDIATE'],
    ['Completa', 'COMPLETE'],
  ]),
  tipo_sinonimo: list<SynonymType>('tipo_sinonimo', [
    ['Tipo de piel', 'SKIN_TYPE'],
    ['Necesidad', 'CONCERN'],
    ['Tipo de producto', 'PRODUCT_TYPE'],
    ['Marca', 'BRAND'],
    ['Ingrediente', 'INGREDIENT'],
    ['Intención', 'INTENT'],
  ]),
  categoria_kb: list<KnowledgeCategory>('categoria_kb', [
    ['Envíos', 'SHIPPING'],
    ['Pagos', 'PAYMENTS'],
    ['Cambios y devoluciones', 'RETURNS'],
    ['Uso de productos', 'PRODUCT_USE'],
    ['Rutinas', 'ROUTINES'],
    ['Embajadoras', 'AMBASSADORS'],
    ['General', 'GENERAL'],
  ]),
  nivel: list<ExperienceLevel>('nivel', [
    ['Básico', 'BASIC'],
    ['Intermedio', 'INTERMEDIATE'],
    ['Avanzado', 'ADVANCED'],
  ]),
  tipo_producto: list<ProductType>('tipo_producto', [
    ['Producto', 'PRODUCT'],
    ['Kit', 'KIT'],
    ['Tamaño de viaje', 'TRAVEL_SIZE'],
  ]),
  si_no_sindato: list<SealValue>('si_no_sindato', [
    ['Sí', 'YES'],
    ['No', 'NO'],
    ['Sin dato', 'UNKNOWN'],
  ]),
  etiqueta: list<ProductLabel>('etiqueta', [
    ['Nuevo', 'NEW'],
    ['Edición limitada', 'LIMITED_EDITION'],
    ['Recomendado por dermatóloga', 'DERMATOLOGIST_RECOMMENDED'],
  ]),
  tipo_aval: list<EndorsementTarget>('tipo_aval', [
    ['Producto', 'PRODUCT'],
    ['Rutina', 'ROUTINE'],
  ]),
} as const

export type ListName = keyof typeof LISTS

/** The schema value for a label, or undefined when it is not in the list. */
export function lookup<T extends string>(def: ListDef<T>, label: string): T | undefined {
  const key = fold(label)
  // "Si" without accent is common in spreadsheets typed by hand.
  return def.labels.find(([l]) => fold(l) === key)?.[1]
}

/** The canonical label for a schema value (for exports and messages). */
export function labelOf<T extends string>(def: ListDef<T>, value: T): string {
  return def.labels.find(([, v]) => v === value)?.[0] ?? value
}

export const listLabels = (def: ListDef) => def.labels.map(([l]) => l).join(', ')
