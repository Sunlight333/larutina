// Diagnosis engine (plan §6.3). Pure functions: no database, no clock, no I/O.
// The caller loads the catalog and passes it in, which is what makes every
// rule unit-testable and the same answers reproducible under a rule version.
import { CONCERN, INGREDIENT_FREQUENCY, SKIN_TYPE, STEP, joinEs, lowerFirst, type StepType } from './copy'
import type { Question } from './questions'

export type Suitability = 'IDEAL' | 'SUITABLE' | 'CAUTION' | 'NOT_RECOMMENDED'
export type Moment = 'AM' | 'PM' | 'BOTH'
export type Slot = 'AM' | 'PM'

export type Answer = { questionKey: string; values: string[] }
export type Attributes = Record<string, number>

export type Interpretation = {
  skinType: string
  sensitive: boolean
  concerns: { slug: string; score: number }[]
  steps: 'basic' | 'complete'
}

export type EngineIngredient = {
  slug: string
  commonName: string
  featured: boolean // ProductIngredient.isKeyActive: shown in this product's "activos"
  isKeyActive: boolean // Ingredient.isKeyActive
  isIrritant: boolean
  concentration: string | null
}

export type EngineProduct = {
  id: string
  slug: string
  name: string
  stepType: StepType
  moment: Moment
  priceCents: number
  suitability: Record<string, Suitability>
  concernRelevance: Record<string, number>
  ingredients: EngineIngredient[]
}

export type EngineConflict = {
  a: string
  b: string
  severity: 'AVOID' | 'CAUTION' | 'ALTERNATE_DAYS'
  note: string
}

export type RoutineStep = {
  stepType: StepType
  productId: string
  score: number
  explanation: string
  frequency?: string
  conflictNote?: string
}

export type Routine = {
  am: RoutineStep[]
  pm: RoutineStep[]
  notes: string[]
}

// ─── Attributes ──────────────────────────────────────────────────────────────

export function deriveAttributes(answers: Answer[], questions: Question[]): Attributes {
  const attrs: Attributes = {}
  for (const a of answers) {
    const q = questions.find((q) => q.key === a.questionKey)
    if (!q) continue
    for (const value of a.values) {
      const opt = q.options.find((o) => o.value === value)
      for (const [k, w] of Object.entries(opt?.weights ?? {})) {
        // pref:* takes the max, everything else sums
        attrs[k] = k.startsWith('pref:') ? Math.max(attrs[k] ?? 0, w) : (attrs[k] ?? 0) + w
      }
    }
  }
  return attrs
}

function pick(attrs: Attributes, prefix: string): Record<string, number> {
  return Object.fromEntries(
    Object.entries(attrs)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  )
}

// Ties resolve in a fixed order so the same answers always give the same result.
// Mixta wins a tie with grasa: it is the conservative call, since what suits
// mixed skin rarely harms oily skin. "normal" is the absence of a signal, so it
// loses every tie.
const SKIN_PRIORITY = ['mixta', 'grasa', 'seca', 'normal']
// Safety first on ties: sensitivity outranks everything.
const CONCERN_PRIORITY = ['sensibilidad', 'acne', 'manchas', 'lineas', 'deshidratacion', 'poros']

function argmax(scores: Record<string, number>, priority: string[]): string | undefined {
  let best: string | undefined
  for (const key of priority) {
    const s = scores[key] ?? 0
    if (s > 0 && (best === undefined || s > (scores[best] ?? 0))) best = key
  }
  return best
}

export function interpret(attrs: Attributes): Interpretation {
  const sensitive = (attrs['flag:sensitive'] ?? 0) >= 2
  const skinScores = pick(attrs, 'skin:')
  // Sensitivity is a modifier, not a skin type, unless it clearly dominates.
  const baseSkin = argmax(skinScores, SKIN_PRIORITY) ?? 'normal'
  const skinType = sensitive && (skinScores.sensible ?? 0) >= (skinScores[baseSkin] ?? 0) ? 'sensible' : baseSkin
  const concerns = Object.entries(pick(attrs, 'concern:'))
    .filter(([, s]) => s >= 2)
    .sort((a, b) => b[1] - a[1] || CONCERN_PRIORITY.indexOf(a[0]) - CONCERN_PRIORITY.indexOf(b[0]))
    .slice(0, 2)
    .map(([slug, score]) => ({ slug, score }))
  const steps = attrs['pref:steps'] === 5 ? 'complete' : 'basic'
  return { skinType, sensitive, concerns, steps }
}

// ─── Routine ─────────────────────────────────────────────────────────────────

type StepSpec = { types: StepType[]; optional?: boolean }

// Optional steps only enter the routine when the winning product works on one
// of the person's concerns. A nightly exfoliant "just because" is how routines
// end up irritating people.
export const TEMPLATES: Record<Interpretation['steps'], Record<Slot, StepSpec[]>> = {
  basic: {
    AM: [{ types: ['CLEANSER'] }, { types: ['MOISTURIZER'] }, { types: ['SUNSCREEN'] }],
    PM: [{ types: ['CLEANSER'] }, { types: ['MOISTURIZER'] }],
  },
  complete: {
    AM: [{ types: ['CLEANSER'] }, { types: ['TONER'] }, { types: ['SERUM'] }, { types: ['MOISTURIZER'] }, { types: ['SUNSCREEN'] }],
    PM: [
      { types: ['CLEANSER'] },
      { types: ['EXFOLIANT'], optional: true },
      { types: ['TREATMENT', 'SERUM'], optional: true },
      { types: ['MOISTURIZER'] },
    ],
  },
}

const SUITABILITY_BONUS: Record<Suitability, number> = {
  IDEAL: 40,
  SUITABLE: 10,
  CAUTION: -30,
  NOT_RECOMMENDED: -Infinity,
}

export type Scored = {
  product: EngineProduct
  score: number
  concernScore: number
  suitability: Suitability
}

export function isExcluded(p: EngineProduct, interp: Interpretation): boolean {
  if (p.suitability[interp.skinType] === 'NOT_RECOMMENDED') return true
  if (interp.sensitive) {
    // A sensitive modifier also applies the "sensible" skin type's exclusions,
    // and drops any product that contains a key active known to irritate.
    if (p.suitability.sensible === 'NOT_RECOMMENDED') return true
    if (p.ingredients.some((i) => i.isIrritant && i.isKeyActive)) return true
  }
  return false
}

/**
 * The actives a product is "about", in the order a person would name them:
 * the ones with a stated concentration first, then true actives, then the
 * rest in INCI order. Shared by the explanations and the product page.
 */
export function featuredActives<T extends Pick<EngineIngredient, 'featured' | 'isKeyActive' | 'concentration'>>(ingredients: T[]): T[] {
  return ingredients
    .map((i, position) => ({ i, position }))
    .filter(({ i }) => i.featured)
    .sort(
      (a, b) =>
        Number(!a.i.concentration) - Number(!b.i.concentration) ||
        Number(!a.i.isKeyActive) - Number(!b.i.isKeyActive) ||
        a.position - b.position,
    )
    .map(({ i }) => i)
}

export function scoreProduct(p: EngineProduct, interp: Interpretation): Scored {
  const suitability = p.suitability[interp.skinType] ?? 'SUITABLE'
  const concernScore = interp.concerns.reduce((sum, c) => sum + (p.concernRelevance[c.slug] ?? 0) * c.score, 0)
  return { product: p, score: concernScore + SUITABILITY_BONUS[suitability], concernScore, suitability }
}

function bestFor(spec: StepSpec, slot: Slot, products: EngineProduct[], interp: Interpretation, used: Set<string>): Scored | undefined {
  const ranked = products
    .filter((p) => spec.types.includes(p.stepType) && (p.moment === slot || p.moment === 'BOTH'))
    .filter((p) => !used.has(p.id) && !isExcluded(p, interp))
    .map((p) => scoreProduct(p, interp))
    .filter((s) => !spec.optional || s.concernScore > 0)
    .sort((a, b) => b.score - a.score || a.product.priceCents - b.product.priceCents || a.product.slug.localeCompare(b.product.slug))
  return ranked[0]
}

export function explain(s: Scored, interp: Interpretation): string {
  const p = s.product
  const actives = featuredActives(p.ingredients)
    .slice(0, 2)
    .map((i) => (i.concentration ? `${lowerFirst(i.commonName)} al ${i.concentration}` : lowerFirst(i.commonName)))
  const helps = interp.concerns
    .filter((c) => (p.concernRelevance[c.slug] ?? 0) >= 50)
    .map((c) => CONCERN[c.slug]?.phrase)
    .filter((x): x is string => Boolean(x))

  const sentences: string[] = []
  if (actives.length && helps.length) {
    sentences.push(`Tiene ${joinEs(actives)}, que ${actives.length > 1 ? 'ayudan' : 'ayuda'} con ${joinEs(helps)}.`)
  } else {
    if (actives.length) sentences.push(`Tiene ${joinEs(actives)}.`)
    sentences.push(STEP[p.stepType].purpose)
  }
  if (s.suitability === 'IDEAL') {
    sentences.push(`Ideal para piel ${SKIN_TYPE[interp.skinType]?.name.toLowerCase() ?? interp.skinType}.`)
  }
  return sentences.join(' ')
}

function keyActives(p: EngineProduct): Set<string> {
  return new Set(p.ingredients.filter((i) => i.featured).map((i) => i.slug))
}

export function generateRoutine(interp: Interpretation, products: EngineProduct[], conflicts: EngineConflict[]): Routine {
  const byId = new Map(products.map((p) => [p.id, p]))
  const template = TEMPLATES[interp.steps]

  const fill = (slot: Slot): RoutineStep[] => {
    const used = new Set<string>()
    const steps: RoutineStep[] = []
    for (const spec of template[slot]) {
      const best = bestFor(spec, slot, products, interp, used)
      if (!best) continue // never render an empty step
      used.add(best.product.id)
      const ingredientFrequency = best.product.ingredients
        .filter((i) => i.featured)
        .map((i) => INGREDIENT_FREQUENCY[i.slug])
        .find(Boolean)
      steps.push({
        stepType: best.product.stepType,
        productId: best.product.id,
        score: best.score,
        explanation: explain(best, interp),
        frequency: ingredientFrequency ?? STEP[best.product.stepType].frequency,
      })
    }
    return steps
  }

  const am = fill('AM')
  const pm = fill('PM')
  const notes: string[] = []

  // Conflict pass: the ingredient model doing real work.
  for (const c of conflicts) {
    const has = (step: RoutineStep, slug: string) => keyActives(byId.get(step.productId)!).has(slug)

    if (c.severity === 'ALTERNATE_DAYS' || c.severity === 'AVOID') {
      const withA = pm.find((s) => has(s, c.a))
      const withB = pm.find((s) => has(s, c.b))
      if (withA && withB && withA !== withB) {
        const [lower, higher] = withA.score < withB.score ? [withA, withB] : [withB, withA]
        lower.frequency = `2 o 3 noches por semana, alternando con ${byId.get(higher.productId)!.name}`
        lower.conflictNote = c.note
      }
    }

    if (c.severity === 'CAUTION') {
      const crosses =
        (am.some((s) => has(s, c.a)) && pm.some((s) => has(s, c.b))) ||
        (am.some((s) => has(s, c.b)) && pm.some((s) => has(s, c.a)))
      if (crosses && !notes.includes(c.note)) notes.push(c.note)
    }
  }

  return { am, pm, notes }
}

// ─── Whole pipeline ──────────────────────────────────────────────────────────

export function diagnose(answers: Answer[], questions: Question[], products: EngineProduct[], conflicts: EngineConflict[]) {
  const attributes = deriveAttributes(answers, questions)
  const interpretation = interpret(attributes)
  const routine = generateRoutine(interpretation, products, conflicts)
  const concernScores = pick(attributes, 'concern:')
  return { attributes, interpretation, routine, concernScores }
}
