// Curated routines: price (RUT-02), what earns the routine discount in the
// cart (RUT-03, RUT-04), and the checks the panel runs when a routine is saved
// (RUT-05, RUT-06). Pure.
import type { Moment } from '@prisma/client'

const PESO = 100

/** RUT-02: the routine's price never goes above the sum of its products. */
export function routinePrice(chargedCents: number[], discountPct: number | null | undefined) {
  const sumCents = chargedCents.reduce((a, b) => a + b, 0)
  const pct = Math.min(100, Math.max(0, discountPct ?? 0))
  const discountCents = Math.floor((sumCents * pct) / 100 / PESO) * PESO
  return { sumCents, discountCents, priceCents: sumCents - discountCents }
}

export type RoutineShape = {
  discountHalves: boolean
  steps: { id: string; moment: Moment; optional: boolean; productIds: string[] }[]
}

export type RoutineScope = 'full' | 'am' | 'pm'

const inScope = (moment: Moment, scope: RoutineScope) => scope === 'full' || moment === 'BOTH' || (scope === 'am' ? moment === 'AM' : moment === 'PM')

/**
 * RUT-03, RUT-04: which part of a routine the cart holds. Every required step
 * must be there, with its main product or one of its alternatives; optional
 * steps may be missing. With halves allowed, the morning or the night alone
 * also counts. Returns the largest scope that is complete, or null.
 */
export function routineScope(routine: RoutineShape, productIdsInCart: Set<string>): RoutineScope | null {
  const has = (s: RoutineShape['steps'][number]) => s.productIds.some((id) => productIdsInCart.has(id))
  const complete = (scope: RoutineScope) => {
    const steps = routine.steps.filter((s) => inScope(s.moment, scope))
    return steps.length > 0 && steps.filter((s) => !s.optional).every(has)
  }
  if (complete('full')) return 'full'
  if (!routine.discountHalves) return null
  if (complete('am')) return 'am'
  if (complete('pm')) return 'pm'
  return null
}

/** The products of the cart that belong to that scope of the routine. */
export function productsInScope(routine: RoutineShape, scope: RoutineScope): Set<string> {
  return new Set(routine.steps.filter((s) => inScope(s.moment, scope)).flatMap((s) => s.productIds))
}

/** BO-04: removing this product from a routine in the cart loses its discount. */
export function removalLosesDiscount(routine: RoutineShape, productIdsInCart: Set<string>, productId: string): boolean {
  const before = routineScope(routine, productIdsInCart)
  if (!before) return false
  const after = new Set(productIdsInCart)
  after.delete(productId)
  const now = routineScope(routine, after)
  return now === null || (before === 'full' && now !== 'full')
}

// ------------------------------------------------------- checks on save ----

export type CheckProduct = {
  name: string
  ingredients: { id: string; name: string; irritant: boolean; familyIds: string[] }[]
}
export type CheckStep = { position: number; moment: Moment; frequency: string | null; product: CheckProduct }
export type CheckConflict = { a: string; b: string; severity: 'AVOID' | 'CAUTION' | 'ALTERNATE_DAYS'; note: string | null }
export type CheckFamily = { id: string; name: string; noDuplicate: boolean }

export type RoutineWarning = { kind: 'conflict' | 'duplicate' | 'sensitive'; message: string }

const MOMENTS = [
  { key: 'AM' as const, label: 'la mañana' },
  { key: 'PM' as const, label: 'la noche' },
]

/**
 * RUT-05: a conflict the step frequency does not resolve (an "alternate days"
 * conflict is resolved when one of the two steps has a frequency), or an
 * irritant ingredient in a routine for sensitive skin. RUT-06: two products of
 * the same moment repeating a "no duplicar" family.
 */
export function checkRoutine(steps: CheckStep[], conflicts: { ingredients: CheckConflict[]; families: CheckConflict[] }, families: CheckFamily[], sensitive: boolean): RoutineWarning[] {
  const out: RoutineWarning[] = []
  const familyById = new Map(families.map((f) => [f.id, f]))
  for (const m of MOMENTS) {
    const here = steps.filter((s) => s.moment === m.key || s.moment === 'BOTH')
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i]!
        const b = here[j]!
        if (a.product.name === b.product.name) continue
        const ingA = new Set(a.product.ingredients.map((x) => x.id))
        const ingB = new Set(b.product.ingredients.map((x) => x.id))
        const famA = new Set(a.product.ingredients.flatMap((x) => x.familyIds))
        const famB = new Set(b.product.ingredients.flatMap((x) => x.familyIds))
        const spaced = !!(a.frequency?.trim() || b.frequency?.trim())
        const hits = [
          ...conflicts.ingredients.filter((c) => (ingA.has(c.a) && ingB.has(c.b)) || (ingA.has(c.b) && ingB.has(c.a))),
          ...conflicts.families.filter((c) => (famA.has(c.a) && famB.has(c.b)) || (famA.has(c.b) && famB.has(c.a))),
        ]
        for (const c of hits) {
          if (c.severity === 'ALTERNATE_DAYS' && spaced) continue
          const how = c.severity === 'ALTERNATE_DAYS' ? 'van en noches alternas: poné la frecuencia en uno de los dos pasos' : c.severity === 'AVOID' ? 'no se combinan' : 'conviene no combinarlos'
          out.push({ kind: 'conflict', message: `En ${m.label}, ${a.product.name} (paso ${a.position}) y ${b.product.name} (paso ${b.position}) ${how}.${c.note ? ` ${c.note}` : ''}` })
        }
        for (const famId of famA) {
          const f = familyById.get(famId)
          if (f?.noDuplicate && famB.has(famId)) {
            out.push({ kind: 'duplicate', message: `En ${m.label}, ${a.product.name} (paso ${a.position}) y ${b.product.name} (paso ${b.position}) repiten ${f.name.toLowerCase()}, que no se duplica en un mismo momento.` })
          }
        }
      }
    }
  }
  if (sensitive) {
    const seen = new Set<string>()
    for (const s of steps) {
      for (const ing of s.product.ingredients.filter((x) => x.irritant)) {
        const key = `${s.product.name}|${ing.id}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ kind: 'sensitive', message: `${s.product.name} (paso ${s.position}) tiene ${ing.name.toLowerCase()}, irritante, y la rutina es para piel sensible.` })
      }
    }
  }
  // The same pair can be reported through several shared ingredients: once is enough.
  return [...new Map(out.map((w) => [w.message, w])).values()]
}
