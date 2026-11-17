import { describe, expect, it } from 'vitest'
import { diagnose, type Answer } from '../../src/lib/diagnosis/engine'
import { questions } from '../../src/lib/diagnosis/questions'
import { engineConflicts, engineProducts } from './fixtures'

const IRRITANT_ACTIVES = new Set(['retinol', 'acido-glicolico', 'acido-salicilico', 'vitamina-c'])

function run(a: Record<string, string | string[]>) {
  const answers: Answer[] = Object.entries(a).map(([questionKey, v]) => ({ questionKey, values: Array.isArray(v) ? v : [v] }))
  return diagnose(answers, questions, engineProducts, engineConflicts)
}

const ids = (steps: { productId: string }[]) => steps.map((s) => s.productId)
const all = (r: ReturnType<typeof run>) => [...r.routine.am, ...r.routine.pm]

describe('diagnosis engine', () => {
  it('oily, acne-prone, basic → purifying gel cleanser, light gel cream, fluid SPF', () => {
    const r = run({
      skin_feel_midday: 'shiny_all',
      breakouts: 'often',
      goals: ['poros'],
      reaction: 'none',
      after_wash: 'shiny_soon',
      routine_size: 'basic',
    })
    expect(r.interpretation.skinType).toBe('grasa')
    expect(ids(r.routine.am)).toEqual(['gel-limpiador-purificante', 'gel-crema-ligero', 'fluido-protector-fps-50'])
    expect(ids(r.routine.pm)).toEqual(['gel-limpiador-purificante', 'gel-crema-ligero'])
  })

  it('dry, dehydrated, complete → cream cleanser, hydrating toner, hyaluronic serum, barrier cream, SPF', () => {
    const r = run({
      skin_feel_midday: 'tight_flaky',
      breakouts: 'rarely',
      goals: ['deshidratacion'],
      reaction: 'none',
      after_wash: 'tight',
      routine_size: 'complete',
    })
    expect(r.interpretation.skinType).toBe('seca')
    const am = ids(r.routine.am)
    expect(am.slice(0, 4)).toEqual(['crema-limpiadora-suave', 'tonico-hidratante', 'serum-acido-hialuronico', 'crema-reparadora-barrera'])
    expect(['protector-mineral-fps-50', 'fluido-protector-fps-50']).toContain(am[4])
  })

  it('sensitive → no retinol, AHA, BHA or vitamin C anywhere in the routine', () => {
    const r = run({
      skin_feel_midday: 'shiny_tzone',
      breakouts: 'monthly',
      goals: ['manchas', 'lineas'],
      reaction: 'burns',
      after_wash: 'fine',
      routine_size: 'complete',
    })
    expect(r.interpretation.sensitive).toBe(true)
    for (const step of all(r)) {
      const p = engineProducts.find((p) => p.id === step.productId)!
      const featured = p.ingredients.filter((i) => i.featured).map((i) => i.slug)
      expect(featured.filter((s) => IRRITANT_ACTIVES.has(s)), p.slug).toEqual([])
    }
  })

  it('normal skin, lines and dark spots, complete → retinol and AHA alternate nights; vitamin C stays in the morning', () => {
    const r = run({
      skin_feel_midday: 'comfortable',
      breakouts: 'rarely',
      goals: ['lineas', 'manchas'],
      reaction: 'none',
      after_wash: 'fine',
      routine_size: 'complete',
    })
    const pm = ids(r.routine.pm)
    expect(pm).toContain('retinol-03-escualano')
    expect(pm).toContain('exfoliante-liquido-aha-7')
    const aha = r.routine.pm.find((s) => s.productId === 'exfoliante-liquido-aha-7')!
    expect(aha.frequency).toMatch(/alternando con Retinol/)
    expect(aha.conflictNote).toBe('Juntos pueden irritar. Se usan en noches alternas.')

    expect(ids(r.routine.am)).toContain('serum-vitamina-c-15')
    expect(r.routine.notes).toEqual(['Mejor la vitamina C de día y el retinol de noche.'])
  })

  it('explains every product it recommends, in a sentence built from data', () => {
    const r = run({
      skin_feel_midday: 'shiny_all',
      breakouts: 'often',
      goals: ['poros'],
      reaction: 'none',
      after_wash: 'shiny_soon',
      routine_size: 'complete',
    })
    for (const s of all(r)) expect(s.explanation.length).toBeGreaterThan(20)
    const serum = r.routine.am.find((s) => s.stepType === 'SERUM')!
    expect(serum.explanation).toBe('Tiene niacinamida al 10% y zinc PCA al 1%, que ayudan con los granitos y los poros. Ideal para piel grasa.')
  })
})

// Every possible way to answer the questionnaire: 3,240 combinations.
function* everyAnswerSet(): Generator<Record<string, string[]>> {
  const choices = questions.map((q) => {
    if (q.type === 'single') return q.options.map((o) => [o.value])
    const values = q.options.map((o) => o.value)
    const sets: string[][] = values.map((v) => [v])
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) sets.push([values[i]!, values[j]!])
    return sets
  })
  function* walk(i: number, acc: Record<string, string[]>): Generator<Record<string, string[]>> {
    if (i === questions.length) return yield { ...acc }
    for (const c of choices[i]!) yield* walk(i + 1, { ...acc, [questions[i]!.key]: c })
  }
  yield* walk(0, {})
}

describe('invariants across every answer combination', () => {
  const combos = [...everyAnswerSet()]

  it('covers the whole questionnaire', () => {
    expect(combos).toHaveLength(3240)
  })

  it('always gives a morning cleanser, moisturizer and sunscreen, and a night cleanser and moisturizer', () => {
    for (const c of combos) {
      const r = run(c)
      const am = r.routine.am.map((s) => s.stepType)
      const pm = r.routine.pm.map((s) => s.stepType)
      expect(am, JSON.stringify(c)).toEqual(expect.arrayContaining(['CLEANSER', 'MOISTURIZER', 'SUNSCREEN']))
      expect(pm, JSON.stringify(c)).toEqual(expect.arrayContaining(['CLEANSER', 'MOISTURIZER']))
      expect(am.at(-1)).toBe('SUNSCREEN')
    }
  })

  it('never recommends a product marked not recommended for the skin type, nor irritants to sensitive skin', () => {
    for (const c of combos) {
      const r = run(c)
      for (const s of all(r)) {
        const p = engineProducts.find((p) => p.id === s.productId)!
        expect(p.suitability[r.interpretation.skinType]).not.toBe('NOT_RECOMMENDED')
        if (r.interpretation.sensitive) {
          expect(p.ingredients.some((i) => i.isKeyActive && i.isIrritant), `${p.slug} ${JSON.stringify(c)}`).toBe(false)
        }
      }
    }
  })

  it('never repeats a product within a slot, and explains every step', () => {
    for (const c of combos) {
      const r = run(c)
      for (const slot of [r.routine.am, r.routine.pm]) {
        expect(new Set(ids(slot)).size).toBe(slot.length)
        for (const s of slot) expect(s.explanation).not.toBe('')
      }
    }
  })

  it('is deterministic', () => {
    for (const c of combos.slice(0, 200)) expect(run(c)).toEqual(run(c))
  })
})
