// The production diagnosis engine against the acceptance of DIA-03..DIA-11, CAT-05..CAT-07.
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULESET as RS } from '@/lib/diagnosis/ruleset'
import { AnswersError, rank, runDiagnosis, type Answer, type EngineCatalog, type EngineProduct } from '@/lib/diagnosis/run'

let n = 0
const product = (code: string, stepType: EngineProduct['stepType'], extra: Partial<EngineProduct> = {}): EngineProduct => ({
  id: `p${++n}`,
  code,
  name: code,
  brand: 'Marca',
  type: 'PRODUCT',
  stepType,
  moment: 'BOTH',
  level: 'BASIC',
  priority: null,
  chargedCents: 1_000_000,
  inStock: true,
  aptitude: { seca: 'SUITABLE', grasa: 'SUITABLE', mixta: 'SUITABLE', normal: 'SUITABLE', sensible: 'SUITABLE' },
  relevance: {},
  ingredients: [],
  ...extra,
})

const retinal = { id: 'ing-retinal', name: 'Retinal', keyActive: true, irritant: true, family: 'retinoide' }
const gluco = { id: 'ing-gluco', name: 'Gluconolactona', keyActive: true, irritant: false, family: 'pha' }

function catalog(extra: EngineProduct[] = []): EngineCatalog {
  return {
    products: [
      product('limpiador', 'CLEANSER'),
      product('crema', 'MOISTURIZER'),
      product('spf', 'SUNSCREEN', { moment: 'AM' }),
      product('tonico', 'TONER'),
      product('serum-vitc', 'SERUM', { moment: 'AM', relevance: { manchas: 80, luminosidad: 90 } }),
      product('serum-retinal', 'TREATMENT', { moment: 'PM', level: 'INTERMEDIATE', relevance: { 'lineas-firmeza': 90, luminosidad: 60 }, ingredients: [retinal] }),
      product('exfoliante-pha', 'EXFOLIANT', { moment: 'PM', relevance: { luminosidad: 85, 'lineas-firmeza': 55 }, ingredients: [gluco] }),
      ...extra,
    ],
    families: [
      { code: 'retinoide', noDuplicate: true },
      { code: 'pha', noDuplicate: false },
    ],
    conflicts: [{ kind: 'family', a: 'retinoide', b: 'pha', severity: 'ALTERNATE_DAYS', note: 'Se alternan.' }],
    concernNames: { manchas: 'Manchas y tono desparejo', luminosidad: 'Luminosidad', 'lineas-firmeza': 'Líneas finas y firmeza', acne: 'Acné y granitos' },
  }
}

const answers = (over: Record<string, string | string[]> = {}): Answer[] => {
  const base: Record<string, string | string[]> = {
    piel_mediodia: 'comoda',
    granitos: 'casi_nunca',
    mejorar: ['lineas', 'apagada'],
    reaccion: 'nada',
    despues_lavar: 'bien',
    pasos: 'completa',
    evitar_retinoides: 'no',
    experiencia: 'seguido',
    ...over,
  }
  return Object.entries(base).map(([questionKey, v]) => ({ questionKey, values: Array.isArray(v) ? v : [v] }))
}

const nameOf = (cat: EngineCatalog, id: string | null) => cat.products.find((p) => p.id === id)?.code ?? null
const pm = (r: ReturnType<typeof runDiagnosis>, cat: EngineCatalog) => r.steps.filter((s) => s.slot === 'PM').map((s) => nameOf(cat, s.productId))

describe('diagnosis engine', () => {
  it('validates the answers: every question once, valid codes, the cap of two (D-12)', () => {
    expect(() => runDiagnosis(RS, answers().slice(1), catalog())).toThrow(AnswersError)
    expect(() => runDiagnosis(RS, answers({ mejorar: ['manchas', 'poros', 'lineas'] }), catalog())).toThrow(/Demasiadas/)
  })

  it('is deterministic: the same answers give the same result (DIA-03)', () => {
    const cat = catalog()
    expect(runDiagnosis(RS, answers(), cat)).toEqual(runDiagnosis(RS, answers(), cat))
    expect(runDiagnosis(RS, answers(), cat).version).toBe(1)
  })

  it('a known conflict goes on alternate nights: retinal + gluconolactona (DIA-08 acceptance)', () => {
    const cat = catalog()
    const r = runDiagnosis(RS, answers(), cat)
    expect(pm(r, cat)).toEqual(['limpiador', 'exfoliante-pha', 'serum-retinal', 'crema'])
    const alternated = r.steps.find((s) => s.frequency?.startsWith('Noches alternas con'))
    expect(alternated).toBeTruthy()
  })

  it('never two "no duplicar" products in one moment (DIA-08, RUT-06)', () => {
    const cat = catalog([product('crema-retinal', 'MOISTURIZER', { moment: 'PM', relevance: { 'lineas-firmeza': 95 }, aptitude: { normal: 'IDEAL' }, ingredients: [retinal] })])
    const r = runDiagnosis(RS, answers(), cat)
    const retinoids = r.steps.filter((s) => s.slot === 'PM' && cat.products.find((p) => p.id === s.productId)?.ingredients.some((i) => i.family === 'retinoide'))
    expect(retinoids).toHaveLength(1)
  })

  it('high sensitivity hides products not recommended for sensitive skin, and irritant actives (DIA-05, R-07)', () => {
    const harsh = product('crema-fuerte', 'MOISTURIZER', { relevance: { 'lineas-firmeza': 100 }, aptitude: { normal: 'IDEAL', sensible: 'NOT_RECOMMENDED' } })
    const cat = catalog([harsh])
    expect(runDiagnosis(RS, answers(), cat).productIds).toContain(harsh.id)
    const r = runDiagnosis(RS, answers({ reaccion: 'arde' }), cat)
    expect(r.interpretation.sensitivity).toBe('high')
    expect(r.productIds).not.toContain(harsh.id)
    expect(pm(r, cat)).not.toContain('serum-retinal')
    expect(r.notes).toContain(RS.texts.highSensitivity)
  })

  it('"Sí, prefiero evitarlos" leaves out the whole retinoid family and is not kept as a signal (DIA-07, R-08)', () => {
    const cat = catalog()
    const r = runDiagnosis(RS, answers({ evitar_retinoides: 'si' }), cat)
    expect(pm(r, cat)).not.toContain('serum-retinal')
    expect(r.signals.some((s) => s.key.startsWith('exclude:'))).toBe(false)
    expect(r.notes).toContain('Dejamos afuera el retinal y el retinol, como pediste.')
  })

  it('a first time with actives excludes advanced products and ramps the strong ones (DIA-06, R-09)', () => {
    const advanced = product('acido-fuerte', 'EXFOLIANT', { moment: 'PM', level: 'ADVANCED', relevance: { luminosidad: 100, 'lineas-firmeza': 100 } })
    const cat = catalog([advanced])
    expect(runDiagnosis(RS, answers(), cat).productIds).toContain(advanced.id)
    const r = runDiagnosis(RS, answers({ experiencia: 'nunca' }), cat)
    expect(r.productIds).not.toContain(advanced.id)
    const retinalStep = r.steps.find((s) => nameOf(cat, s.productId) === 'serum-retinal')!
    expect(retinalStep.ramp).toBe(true)
    expect(r.notes).toContain(RS.texts.firstActives)
  })

  it('an out-of-stock main gives way to the first alternative in stock; none in stock, "sin stock" and out of the total (DIA-09, R-17)', () => {
    const cat = catalog([product('crema-b', 'MOISTURIZER', { chargedCents: 900_000 })])
    const crema = cat.products.find((p) => p.code === 'crema')!
    crema.relevance = { 'lineas-firmeza': 60 } // the best moisturizer for her
    crema.inStock = false
    const r = runDiagnosis(RS, answers(), cat)
    const step = r.steps.find((s) => s.stepType === 'MOISTURIZER' && s.slot === 'AM')!
    expect(nameOf(cat, step.productId)).toBe('crema-b')
    expect(nameOf(cat, step.replacedId)).toBe('crema')

    cat.products.find((p) => p.code === 'crema-b')!.inStock = false
    const none = runDiagnosis(RS, answers(), cat).steps.find((s) => s.stepType === 'MOISTURIZER' && s.slot === 'AM')!
    expect(none.productId).toBeNull()
  })

  it('priority breaks a tie within the window, never a clear difference (CAT-06)', () => {
    const a = product('a', 'SERUM', { priority: 2 })
    const b = product('b', 'SERUM', { priority: 1 })
    expect(rank([{ p: a, score: 80 }, { p: b, score: 78 }], 3)[0]!.p.code).toBe('b')
    expect(rank([{ p: a, score: 80 }, { p: b, score: 70 }], 3)[0]!.p.code).toBe('a')
  })

  it('kits and travel sizes never enter the result (CAT-07)', () => {
    const kit = product('kit', 'MOISTURIZER', { type: 'KIT', relevance: { 'lineas-firmeza': 100 }, aptitude: { normal: 'IDEAL' } })
    expect(runDiagnosis(RS, answers(), catalog([kit])).productIds).not.toContain(kit.id)
  })

  it('reacting often and frequent breakouts recommend a dermatologist and keep it gentle (R-10)', () => {
    const r = runDiagnosis(RS, answers({ reaccion: 'arde', granitos: 'seguido' }), catalog())
    expect(r.interpretation.referral).toBe(true)
  })

  it('a step the catalog cannot fill shows the few-products notice (DIA-11)', () => {
    const cat = catalog()
    cat.products = cat.products.filter((p) => p.stepType !== 'SUNSCREEN')
    expect(runDiagnosis(RS, answers(), cat).fewProducts).toBe(true)
    expect(runDiagnosis(RS, answers(), catalog()).fewProducts).toBe(false)
  })

  it('explains each step by her needs (R-13)', () => {
    const cat = catalog()
    const r = runDiagnosis(RS, answers(), cat)
    const retinalStep = r.steps.find((s) => nameOf(cat, s.productId) === 'serum-retinal')!
    expect(retinalStep.because).toBe('Lo elegimos por líneas finas y firmeza y por luminosidad.')
  })
})
