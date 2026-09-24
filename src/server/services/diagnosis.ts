import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { answersSchema, decodeAnswers, encodeAnswers } from '@/lib/diagnosis/answers'
import { diagnose, type Answer, type Routine } from '@/lib/diagnosis/engine'
import { questions, RULE_VERSION } from '@/lib/diagnosis/questions'
import { getCatalog, toEngineConflicts, toEngineProduct } from './catalog'

export { answersSchema }

async function compute(answers: Answer[]) {
  const { products, conflicts } = await getCatalog()
  return diagnose(answers, questions, products.map(toEngineProduct), toEngineConflicts(conflicts))
}

/**
 * Stores raw answers and the derived result together and returns the result
 * id. Nested writes run in a single transaction: a diagnosis never exists
 * without its answers and result. Without a database, the id is the answer
 * code itself.
 */
export async function createDiagnosis(input: unknown): Promise<string> {
  const answers = answersSchema.parse(input)
  if (!db) return encodeAnswers(answers)

  const result = await compute(answers)
  const diagnosis = await db.diagnosis.create({
    data: {
      ruleVersion: RULE_VERSION,
      answers: { create: answers.map((a) => ({ questionKey: a.questionKey, values: a.values })) },
      result: {
        create: {
          skinTypeSlug: result.interpretation.skinType,
          concernScores: result.concernScores,
          attributes: { ...result.attributes, interpretation: result.interpretation } as unknown as Prisma.InputJsonObject,
          routine: result.routine as unknown as Prisma.InputJsonObject,
        },
      },
    },
    select: { id: true },
  })
  return diagnosis.id
}

export type StoredInterpretation = {
  skinType: string
  sensitive: boolean
  concerns: { slug: string; score: number }[]
  steps: 'basic' | 'complete'
}

/**
 * Reads a result. A stored result is read as saved, not recomputed: the link
 * shows the same routine on any device, and a rule change later does not
 * silently rewrite what someone was told. An answer-code link (no database)
 * is recomputed, which is deterministic under the rule version in the code.
 */
export const getDiagnosisResult = cache(async (id: string) => {
  const decoded = decodeAnswers(id)
  if (decoded) {
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
  }
  if (!db) return null

  const diagnosis = await db.diagnosis.findUnique({
    where: { id },
    include: { answers: true, result: true },
  })
  if (!diagnosis?.result) return null

  const { interpretation, ...attributes } = diagnosis.result.attributes as Record<string, number> & {
    interpretation: StoredInterpretation
  }
  return {
    id: diagnosis.id,
    stored: true,
    ruleVersion: diagnosis.ruleVersion,
    answers: diagnosis.answers.map((a) => ({ questionKey: a.questionKey, values: a.values })),
    skinType: diagnosis.result.skinTypeSlug,
    interpretation,
    attributes: attributes as Record<string, number>,
    routine: diagnosis.result.routine as unknown as Routine,
  }
})
