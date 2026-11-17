import { describe, expect, it } from 'vitest'
import { decodeAnswers, encodeAnswers } from '../../src/lib/diagnosis/answers'
import { diagnose } from '../../src/lib/diagnosis/engine'
import { questions } from '../../src/lib/diagnosis/questions'
import { toEngineConflicts, toEngineProduct } from '../../src/server/services/catalog'
import { sampleCatalog } from '../../src/server/services/sample-catalog'
import { engineConflicts, engineProducts } from './fixtures'

function* everyAnswerSet() {
  const choices = questions.map((q) => {
    if (q.type === 'single') return q.options.map((o) => [o.value])
    const values = q.options.map((o) => o.value)
    const sets: string[][] = values.map((v) => [v])
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) sets.push([values[i]!, values[j]!])
    return sets
  })
  function* walk(i: number, acc: { questionKey: string; values: string[] }[]): Generator<typeof acc> {
    if (i === questions.length) return yield acc
    for (const c of choices[i]!) yield* walk(i + 1, [...acc, { questionKey: questions[i]!.key, values: c }])
  }
  yield* walk(0, [])
}

describe('answer codes (result links without a database)', () => {
  it('round-trips every one of the 3,240 answer combinations', () => {
    let n = 0
    for (const answers of everyAnswerSet()) {
      const code = encodeAnswers(answers)
      expect(code).toMatch(/^v1-[0-9-]+$/)
      expect(decodeAnswers(code)).toEqual(answers)
      n++
    }
    expect(n).toBe(3240)
  })

  it('rejects anything that is not a valid code', () => {
    for (const bad of ['', 'cmufob33p00005da0eoagaqq9', 'v1-1-2', 'v1-9-0-0-0-0-0', 'v1-1-2-012-0-2-1', 'v1-1-2-00-0-2-1', 'v2-1-2-03-0-2-1', 'v1-1-2--0-2-1']) {
      expect(decodeAnswers(bad), bad).toBeNull()
    }
  })
})

describe('sample catalog (no database)', () => {
  const { products, conflicts } = sampleCatalog()

  it('has the full seeded catalog', () => {
    expect(products).toHaveLength(18)
    expect(conflicts).toHaveLength(2)
  })

  it('produces exactly the routines the seeded data produces', () => {
    const fromSample = products.map(toEngineProduct)
    const sampleConflicts = toEngineConflicts(conflicts)
    let i = 0
    for (const answers of everyAnswerSet()) {
      if (i++ % 7) continue // a spread-out sample of ~460 combinations
      expect(diagnose(answers, questions, fromSample, sampleConflicts)).toEqual(diagnose(answers, questions, engineProducts, engineConflicts))
    }
  })
})
