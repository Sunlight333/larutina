// The diagnosis engine (DIA-03..DIA-11, CAT-05..CAT-07, 03 §2 "Engine").
// Pure and deterministic: rule set + answers + catalog → result. The same
// inputs always give the same routine, which is what makes a diagnosis
// reproducible by its rule version.
//
//   1. answers → signals (source "answer", confidence 1; Phase 4 adds images)
//   2. signals → base skin type, needs (capped), sensitivity, steps, exclusions,
//      experience, referral
//   3. safety filters first: products only (no kits or travel sizes), skin
//      type "no recomendado", the "sensible" aptitude from medium sensitivity,
//      irritant actives when sensitivity is high or a referral applies,
//      excluded families, advanced level for a first time
//   4. score by need relevance and skin aptitude; priority breaks ties within
//      the window, never across the filters
//   5. per moment: one product per step; never two of a "no duplicar" family
//      or an "avoid" pair in the same moment; "alternate days" pairs go on
//      alternate nights; strong actives ramp for a first time
//   6. stock: out-of-stock main → first alternative in stock; none → "sin stock"
import type { RuleSet } from './ruleset'

export type Aptitude = 'IDEAL' | 'SUITABLE' | 'CAUTION' | 'NOT_RECOMMENDED'
export type Slot = 'AM' | 'PM'
export type StepType = 'MAKEUP_REMOVER' | 'CLEANSER' | 'EXFOLIANT' | 'TONER' | 'ESSENCE' | 'SERUM' | 'EYE_CONTOUR' | 'MOISTURIZER' | 'OIL' | 'SUNSCREEN' | 'MASK' | 'TREATMENT'

export type EngineProduct = {
  id: string
  code: string
  name: string
  brand: string
  type: 'PRODUCT' | 'KIT' | 'TRAVEL_SIZE'
  stepType: StepType
  moment: 'AM' | 'PM' | 'BOTH'
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null
  priority: number | null
  chargedCents: number
  inStock: boolean
  aptitude: Record<string, Aptitude>
  relevance: Record<string, number>
  ingredients: { id: string; name: string; keyActive: boolean; irritant: boolean; family: string | null }[]
}

export type EngineFamily = { code: string; noDuplicate: boolean }
export type EngineConflict = { kind: 'ingredient' | 'family'; a: string; b: string; severity: 'AVOID' | 'CAUTION' | 'ALTERNATE_DAYS'; note: string | null }

export type EngineCatalog = {
  products: EngineProduct[]
  families: EngineFamily[]
  conflicts: EngineConflict[]
  /** Need names for the explanations ("Lo elegimos por manchas y tono desparejo"). */
  concernNames: Record<string, string>
}

export type Answer = { questionKey: string; values: string[] }

export type Interpretation = {
  skinType: string
  sensitivity: 'low' | 'medium' | 'high'
  concerns: { code: string; score: number }[]
  steps: 'basic' | 'complete'
  excluded: string[]
  experience: 'never' | 'sometimes' | 'often' | null
  referral: boolean
}

export type ResultStep = {
  slot: Slot
  position: number
  stepType: StepType
  /** Null: no product in stock for this step (DIA-09), not counted in the total. */
  productId: string | null
  /** The best product when it was out of stock and replaced (R-17). */
  replacedId: string | null
  score: number
  because: string
  frequency: string | null
  caution: string | null
  ramp: boolean
  /** Up to N in-stock alternatives, cheapest first (R-16). */
  alternatives: string[]
}

export type DiagnosisResult = {
  version: number
  signals: { key: string; value: number; source: 'answer'; confidence: number }[]
  interpretation: Interpretation
  steps: ResultStep[]
  notes: string[]
  fewProducts: boolean
  /** Every product in the routine, once (R-18). */
  productIds: string[]
}

export class AnswersError extends Error {}

const TEMPLATES: Record<Interpretation['steps'], Record<Slot, { types: StepType[]; optional?: boolean }[]>> = {
  basic: {
    AM: [{ types: ['CLEANSER'] }, { types: ['MOISTURIZER'] }, { types: ['SUNSCREEN'] }],
    PM: [{ types: ['CLEANSER'] }, { types: ['MOISTURIZER'] }],
  },
  complete: {
    AM: [{ types: ['CLEANSER'] }, { types: ['TONER'] }, { types: ['SERUM'] }, { types: ['MOISTURIZER'] }, { types: ['SUNSCREEN'] }],
    PM: [{ types: ['CLEANSER'] }, { types: ['EXFOLIANT'], optional: true }, { types: ['TREATMENT', 'SERUM'], optional: true }, { types: ['MOISTURIZER'] }],
  },
}

const APTITUDE_BONUS: Record<Aptitude, number> = { IDEAL: 10, SUITABLE: 0, CAUTION: -20, NOT_RECOMMENDED: -Infinity }
/** An optional step enters only when its product works on one of her needs (R-13). */
const OPTIONAL_RELEVANCE = 50

/** Checks answers against the rule set: every question once, valid codes, caps. */
export function validateAnswers(rs: RuleSet, answers: Answer[]): Answer[] {
  const out: Answer[] = []
  for (const q of rs.questions) {
    const a = answers.find((x) => x.questionKey === q.key)
    if (!a || !a.values.length) throw new AnswersError(`Falta responder "${q.prompt}"`)
    const codes = new Set(q.options.map((o) => o.code))
    const values = [...new Set(a.values)]
    if (values.some((v) => !codes.has(v))) throw new AnswersError(`Opción inválida en "${q.prompt}"`)
    const max = q.type === 'single' ? 1 : (q.max ?? q.options.length)
    if (values.length > max) throw new AnswersError(`Demasiadas opciones en "${q.prompt}"`)
    out.push({ questionKey: q.key, values })
  }
  return out
}

export function interpret(rs: RuleSet, answers: Answer[]): { signals: DiagnosisResult['signals']; interpretation: Interpretation } {
  const sums: Record<string, number> = {}
  for (const a of answers) {
    const q = rs.questions.find((x) => x.key === a.questionKey)!
    for (const v of a.values) for (const [k, w] of Object.entries(q.options.find((o) => o.code === v)!.signals)) sums[k] = (sums[k] ?? 0) + w
  }
  const prefixed = (p: string) => Object.entries(sums).filter(([k]) => k.startsWith(p)).map(([k, v]) => [k.slice(p.length), v] as const)

  let skinType = 'normal'
  let best = 0
  for (const code of rs.rules.skinPriority) {
    const v = sums[`skin:${code}`] ?? 0
    if (v > best) {
      best = v
      skinType = code
    }
  }
  const s = sums.sensitivity ?? 0
  const sensitivity = s >= rs.rules.sensitivityHigh ? 'high' : s >= rs.rules.sensitivityMedium ? 'medium' : 'low'
  const order = (c: string) => {
    const i = rs.rules.concernPriority.indexOf(c)
    return i < 0 ? 99 : i
  }
  const concerns = prefixed('concern:')
    .filter(([, v]) => v >= rs.rules.concernMin)
    .sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))
    .slice(0, rs.rules.concernsCap)
    .map(([code, score]) => ({ code, score }))
  const excluded = prefixed('exclude:').filter(([code, v]) => v > 0 && rs.rules.excludableFamilies.includes(code)).map(([code]) => code)
  const experience = sums['experience:never'] ? 'never' : sums['experience:sometimes'] ? 'sometimes' : sums['experience:often'] ? 'often' : null
  const referral = rs.rules.referral.length > 0 && rs.rules.referral.every((c) => answers.find((a) => a.questionKey === c.question)?.values.some((v) => c.anyOf.includes(v)))

  return {
    signals: Object.entries(sums)
      .filter(([k]) => !k.startsWith('exclude:'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value, source: 'answer' as const, confidence: 1 })),
    interpretation: { skinType, sensitivity, concerns, steps: sums['steps:complete'] ? 'complete' : 'basic', excluded, experience, referral },
  }
}

const familiesOf = (p: EngineProduct) => new Set(p.ingredients.map((i) => i.family).filter((f): f is string => !!f))
const strongActive = (p: EngineProduct) => p.ingredients.some((i) => i.irritant && i.keyActive)

/** Step 3: what may never enter this routine, whatever its score. */
export function allowed(p: EngineProduct, it: Interpretation): boolean {
  if (p.type !== 'PRODUCT') return false // CAT-07
  if (p.aptitude[it.skinType] === 'NOT_RECOMMENDED') return false
  if (it.sensitivity !== 'low' && p.aptitude.sensible === 'NOT_RECOMMENDED') return false // DIA-05, D-07
  if ((it.sensitivity === 'high' || it.referral) && strongActive(p)) return false // R-07, R-10
  const fam = familiesOf(p)
  if (it.excluded.some((f) => fam.has(f))) return false // DIA-07
  if (it.experience === 'never' && p.level === 'ADVANCED') return false // DIA-06
  return true
}

export function score(p: EngineProduct, it: Interpretation): number {
  const weight = it.concerns.reduce((a, c) => a + c.score, 0)
  const relevance = weight ? it.concerns.reduce((a, c) => a + (p.relevance[c.code] ?? 0) * c.score, 0) / weight : 0
  return Math.round((relevance + APTITUDE_BONUS[p.aptitude[it.skinType] ?? 'SUITABLE']) * 10) / 10
}

/** CAT-06: by score; within the tie window of the best, priority first, then price, then code. */
export function rank(candidates: { p: EngineProduct; score: number }[], tieWindow: number) {
  const byScore = [...candidates].sort((a, b) => b.score - a.score || a.p.code.localeCompare(b.p.code))
  const out: typeof candidates = []
  const left = [...byScore]
  while (left.length) {
    const top = left[0]!.score
    const tied = left.filter((c) => top - c.score <= tieWindow)
    tied.sort((a, b) => (a.p.priority ?? 1e9) - (b.p.priority ?? 1e9) || a.p.chargedCents - b.p.chargedCents || a.p.code.localeCompare(b.p.code))
    out.push(tied[0]!)
    left.splice(left.indexOf(tied[0]!), 1)
  }
  return out
}

const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
const joinEs = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`)

function conflictBetween(a: EngineProduct, b: EngineProduct, conflicts: EngineConflict[]) {
  const ia = new Set(a.ingredients.map((i) => i.id))
  const ib = new Set(b.ingredients.map((i) => i.id))
  const fa = familiesOf(a)
  const fb = familiesOf(b)
  const hits = conflicts.filter((c) =>
    c.kind === 'ingredient' ? (ia.has(c.a) && ib.has(c.b)) || (ia.has(c.b) && ib.has(c.a)) : (fa.has(c.a) && fb.has(c.b)) || (fa.has(c.b) && fb.has(c.a)),
  )
  const order = { AVOID: 0, ALTERNATE_DAYS: 1, CAUTION: 2 }
  return hits.sort((x, y) => order[x.severity] - order[y.severity])[0] ?? null
}

export function runDiagnosis(rs: RuleSet, rawAnswers: Answer[], catalog: EngineCatalog): DiagnosisResult {
  const answers = validateAnswers(rs, rawAnswers)
  const { signals, interpretation: it } = interpret(rs, answers)
  const noDup = new Set(catalog.families.filter((f) => f.noDuplicate).map((f) => f.code))
  const byId = new Map(catalog.products.map((p) => [p.id, p]))
  const pool = catalog.products.filter((p) => allowed(p, it))
  const steps: ResultStep[] = []
  let missingRequired = 0

  for (const slot of ['AM', 'PM'] as Slot[]) {
    const chosen: EngineProduct[] = []
    let position = 0
    for (const spec of TEMPLATES[it.steps][slot]) {
      const fits = (p: EngineProduct) => {
        if (!spec.types.includes(p.stepType) || (p.moment !== slot && p.moment !== 'BOTH')) return false
        if (chosen.some((c) => c.id === p.id)) return false
        // DIA-08, RUT-06: never two of a "no duplicar" family, nor an "avoid" pair, in one moment.
        const fam = familiesOf(p)
        if (chosen.some((c) => [...familiesOf(c)].some((f) => noDup.has(f) && fam.has(f)))) return false
        if (chosen.some((c) => conflictBetween(c, p, catalog.conflicts)?.severity === 'AVOID')) return false
        return true
      }
      let ranked = rank(
        pool.filter(fits).map((p) => ({ p, score: score(p, it) })),
        rs.rules.tieWindow,
      )
      if (spec.optional) ranked = ranked.filter((r) => it.concerns.some((c) => (r.p.relevance[c.code] ?? 0) >= OPTIONAL_RELEVANCE))
      if (!ranked.length) {
        if (!spec.optional) missingRequired++ // DIA-11: the catalog has nothing for a step she needs
        continue
      }
      const best = ranked[0]!
      const inStock = ranked.filter((r) => r.p.inStock)
      const pickedRank = best.p.inStock ? best : (inStock[0] ?? null)
      const picked = pickedRank?.p ?? null
      if (picked) chosen.push(picked)
      const hits = it.concerns.filter((c) => ((picked ?? best.p).relevance[c.code] ?? 0) >= OPTIONAL_RELEVANCE).map((c) => catalog.concernNames[c.code]?.toLowerCase() ?? c.code)
      steps.push({
        slot,
        position: ++position,
        stepType: (picked ?? best.p).stepType,
        productId: picked?.id ?? null,
        replacedId: picked && picked.id !== best.p.id ? best.p.id : null,
        score: (pickedRank ?? best).score,
        because: hits.length ? fill(rs.texts.because, { necesidades: joinEs(hits.map((h, i) => (i ? `por ${h}` : h))) }) : '',
        frequency: null,
        caution: null,
        ramp: false,
        alternatives: inStock
          .filter((r) => r.p.id !== picked?.id)
          .slice(0, rs.rules.alternatives)
          .sort((a, b) => a.p.chargedCents - b.p.chargedCents)
          .map((r) => r.p.id),
      })
    }
  }

  // Conflicts inside a moment (DIA-08) and the ramp (DIA-06).
  for (const slot of ['AM', 'PM'] as Slot[]) {
    const here = steps.filter((s) => s.slot === slot && s.productId)
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i]!
        const b = here[j]!
        const c = conflictBetween(byId.get(a.productId!)!, byId.get(b.productId!)!, catalog.conflicts)
        if (!c) continue
        const [lower, higher] = a.score < b.score ? [a, b] : [b, a]
        const other = byId.get(higher.productId!)!.name
        if (c.severity === 'ALTERNATE_DAYS') lower.frequency = fill(rs.texts.alternateWith, { producto: other })
        else if (c.severity === 'CAUTION') lower.caution = fill(rs.texts.caution, { producto: other, nota: c.note ?? '' }).replace(/:\s*$/, '.')
      }
    }
  }
  for (const s of steps) {
    if (!s.productId) continue
    const p = byId.get(s.productId)!
    const ramp = it.experience === 'never' ? p.level === 'INTERMEDIATE' || p.level === 'ADVANCED' || strongActive(p) : it.experience === 'sometimes' ? p.level === 'ADVANCED' : false
    if (ramp) {
      s.ramp = true
      s.frequency ??= rs.texts.rampFrequency
    }
  }

  const notes: string[] = []
  if (rs.texts.skin[it.skinType]) notes.push(rs.texts.skin[it.skinType]!)
  if (it.sensitivity === 'high') notes.push(rs.texts.highSensitivity)
  for (const f of it.excluded) if (rs.texts.excluded[f]) notes.push(rs.texts.excluded[f]!)
  if (it.experience === 'never' && steps.some((s) => s.ramp)) notes.push(rs.texts.firstActives)

  const counted = (slot: Slot) => steps.filter((s) => s.slot === slot && s.productId).length
  const required = (slot: Slot) => TEMPLATES[it.steps][slot].filter((t) => !t.optional).length
  return {
    version: rs.version,
    signals,
    interpretation: it,
    steps,
    notes,
    // DIA-11, R-23: a step she needs found nothing, or a moment ended short of what its template asks.
    fewProducts: missingRequired > 0 || (['AM', 'PM'] as Slot[]).some((slot) => counted(slot) < Math.min(rs.rules.minStepsPerMoment, required(slot))),
    productIds: [...new Set(steps.map((s) => s.productId).filter((x): x is string => !!x))],
  }
}
