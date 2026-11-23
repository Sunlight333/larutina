// Spanish labels for the catalog lists (A3 "Listas"). Pure, so client
// components can import them too.
import type { Aptitude, Moment, ProductLabel, RoutineStepType, Unit } from '@prisma/client'

export const STEP_LABELS: Record<RoutineStepType, string> = {
  MAKEUP_REMOVER: 'Desmaquillante',
  CLEANSER: 'Limpiador',
  EXFOLIANT: 'Exfoliante',
  TONER: 'Tónico',
  ESSENCE: 'Esencia',
  SERUM: 'Sérum',
  EYE_CONTOUR: 'Contorno de ojos',
  MOISTURIZER: 'Hidratante',
  OIL: 'Aceite',
  SUNSCREEN: 'Protector solar',
  MASK: 'Mascarilla',
  TREATMENT: 'Tratamiento',
}

export const MOMENT_LABELS: Record<Moment, string> = { AM: 'De mañana', PM: 'De noche', BOTH: 'De mañana y de noche' }

export const APTITUDE_LABELS: Record<Aptitude, string> = {
  IDEAL: 'Ideal',
  SUITABLE: 'Apto',
  CAUTION: 'Con precaución',
  NOT_RECOMMENDED: 'No recomendado',
}

export const LABEL_TEXT: Record<ProductLabel, string> = {
  NEW: 'Nuevo',
  LIMITED_EDITION: 'Edición limitada',
  DERMATOLOGIST_RECOMMENDED: 'Recomendado por dermatóloga',
}

export const UNIT_SHORT: Record<Unit, string> = { ML: 'ml', G: 'g', UNITS: 'unidades' }

export const SEAL_LABELS = {
  vegan: 'Vegano',
  crueltyFree: 'Cruelty free',
  dermatologistTested: 'Testeado dermatológicamente',
} as const
export type SealKey = keyof typeof SEAL_LABELS

/** "Productos" with the right number: 1 producto, 3 productos. */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`
}
