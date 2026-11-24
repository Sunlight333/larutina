import { describe, expect, it } from 'vitest'
import { checkRoutine, removalLosesDiscount, routinePrice, routineScope, type CheckStep, type RoutineShape } from '@/lib/commerce/routine'

describe('routine price (RUT-02)', () => {
  it('is the sum less the discount, in whole pesos, never above the sum', () => {
    expect(routinePrice([1_890_000, 990_000], 10)).toEqual({ sumCents: 2_880_000, discountCents: 288_000, priceCents: 2_592_000 })
    expect(routinePrice([1_000_050], 0).priceCents).toBe(1_000_050)
    expect(routinePrice([100_000], 150).priceCents).toBe(0)
  })
})

const routine = (halves: boolean): RoutineShape => ({
  discountHalves: halves,
  steps: [
    { id: 's1', moment: 'BOTH', optional: false, productIds: ['cleanser', 'cleanser-alt'] },
    { id: 's2', moment: 'AM', optional: false, productIds: ['spf'] },
    { id: 's3', moment: 'AM', optional: true, productIds: ['toner'] },
    { id: 's4', moment: 'PM', optional: false, productIds: ['retinal'] },
  ],
})

describe('routine discount in the cart (RUT-03, RUT-04)', () => {
  it('the whole routine earns it; an alternative or a missing optional step keeps it', () => {
    expect(routineScope(routine(false), new Set(['cleanser', 'spf', 'toner', 'retinal']))).toBe('full')
    expect(routineScope(routine(false), new Set(['cleanser-alt', 'spf', 'retinal']))).toBe('full')
  })

  it('removing a required step loses it, with the notice (BO-04)', () => {
    const cart = new Set(['cleanser', 'spf', 'retinal'])
    expect(removalLosesDiscount(routine(false), cart, 'retinal')).toBe(true)
    expect(removalLosesDiscount(routine(false), new Set([...cart, 'toner']), 'toner')).toBe(false)
  })

  it('a half earns it only when the routine allows halves', () => {
    const morning = new Set(['cleanser', 'spf'])
    expect(routineScope(routine(false), morning)).toBeNull()
    expect(routineScope(routine(true), morning)).toBe('am')
    expect(routineScope(routine(true), new Set(['cleanser', 'retinal']))).toBe('pm')
  })
})

const step = (position: number, moment: CheckStep['moment'], name: string, ingredients: CheckStep['product']['ingredients'], frequency: string | null = null): CheckStep => ({ position, moment, frequency, product: { name, ingredients } })
const retinal = { id: 'retinal', name: 'Retinal', irritant: true, familyIds: ['retinoide'] }
const retinol = { id: 'retinol', name: 'Retinol', irritant: true, familyIds: ['retinoide'] }
const gluco = { id: 'gluconolactona', name: 'Gluconolactona', irritant: false, familyIds: ['pha'] }
const lavanda = { id: 'lavanda', name: 'Aceite de lavanda', irritant: true, familyIds: ['aceite-esencial'] }
const families = [
  { id: 'retinoide', name: 'Retinoide', noDuplicate: true },
  { id: 'pha', name: 'PHA', noDuplicate: false },
  { id: 'aceite-esencial', name: 'Aceite esencial', noDuplicate: false },
]

describe('checks on save (RUT-05, RUT-06)', () => {
  it('two retinoids the same night warn (RUT-06 acceptance: cream and eye contour with retinal)', () => {
    const w = checkRoutine([step(3, 'PM', 'Crema con retinal', [retinal]), step(4, 'PM', 'Contorno con retinal', [retinal])], { ingredients: [], families: [] }, families, false)
    expect(w).toHaveLength(1)
    expect(w[0]!.kind).toBe('duplicate')
    expect(w[0]!.message).toContain('repiten retinoide')
  })

  it('an alternate-nights conflict is resolved by a step frequency, an avoid conflict never', () => {
    const conflicts = { ingredients: [{ a: 'retinol', b: 'gluconolactona', severity: 'ALTERNATE_DAYS' as const, note: null }], families: [] }
    const steps = [step(2, 'PM', 'Sérum de retinol', [retinol]), step(3, 'PM', 'Tónico PHA', [gluco])]
    expect(checkRoutine(steps, conflicts, families, false)).toHaveLength(1)
    expect(checkRoutine([steps[0]!, { ...steps[1]!, frequency: 'Noches alternas' }], conflicts, families, false)).toHaveLength(0)
    const avoid = { ingredients: [{ ...conflicts.ingredients[0]!, severity: 'AVOID' as const }], families: [] }
    expect(checkRoutine([steps[0]!, { ...steps[1]!, frequency: 'Noches alternas' }], avoid, families, false)).toHaveLength(1)
  })

  it('a morning product and a night product never conflict', () => {
    const conflicts = { ingredients: [{ a: 'retinol', b: 'gluconolactona', severity: 'AVOID' as const, note: null }], families: [] }
    expect(checkRoutine([step(1, 'AM', 'Tónico PHA', [gluco]), step(2, 'PM', 'Sérum de retinol', [retinol])], conflicts, families, false)).toEqual([])
  })

  it('an irritant in a routine for sensitive skin warns (RUT-05: Calma y reparación with essential oils)', () => {
    const w = checkRoutine([step(1, 'BOTH', 'Limpiador con lavanda', [lavanda])], { ingredients: [], families: [] }, families, true)
    expect(w.map((x) => x.kind)).toEqual(['sensitive'])
    expect(checkRoutine([step(1, 'BOTH', 'Limpiador con lavanda', [lavanda])], { ingredients: [], families: [] }, families, false)).toEqual([])
  })
})
