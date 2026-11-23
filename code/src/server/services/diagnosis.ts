// The demo diagnosis. Results are not stored: the result id is the answer
// code itself, and the engine is deterministic under RULE_VERSION, so a link
// shows the same routine on any device. The real diagnosis (Phase 3) stores
// answers, signals and the rule-set version in PostgreSQL.
import { cache } from 'react'
import { answersSchema, decodeAnswers, encodeAnswers } from '@/lib/diagnosis/answers'
import { diagnose, type Answer } from '@/lib/diagnosis/engine'
import { questions, RULE_VERSION } from '@/lib/diagnosis/questions'
import { getCatalog, toEngineConflicts, toEngineProduct } from './catalog'

export { answersSchema }

async function compute(answers: Answer[]) {
  const { products, conflicts } = await getCatalog()
  return diagnose(answers, questions, products.map(toEngineProduct), toEngineConflicts(conflicts))
}

/** Validates the answers and returns the result id (the answer code). */
export async function createDiagnosis(input: unknown): Promise<string> {
  return encodeAnswers(answersSchema.parse(input))
}

export type StoredInterpretation = {
  skinType: string
  sensitive: boolean
  concerns: { slug: string; score: number }[]
  steps: 'basic' | 'complete'
}

/** Recomputes a result from its answer code; null for an unknown id. */
export const getDiagnosisResult = cache(async (id: string) => {
  const decoded = decodeAnswers(id)
  if (!decoded) return null
  const result = await compute(decoded)
  return {
    id,
    stored: false,
    ruleVersion: RULE_VERSION,
    answers: decoded,
    skinType: result.interpretation.skinType,
    interpretation: result.interpretation as StoredInterpretation,
    attributes: result.attributes,
    routine: result.routine,
  }
})
