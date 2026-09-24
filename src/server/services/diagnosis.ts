import { cache } from 'react'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { diagnose, type Routine } from '@/lib/diagnosis/engine'
import { questions, RULE_VERSION } from '@/lib/diagnosis/questions'
import { getCatalog, toEngineConflicts, toEngineProduct } from './catalog'

/**
 * Validates a full set of answers against questionnaire v1: every question
 * answered once, every value a real option, single questions with exactly one
 * value, multi questions within their limit.
 */
export const answersSchema = z
  .array(z.object({ questionKey: z.string(), values: z.array(z.string()).min(1) }))
  .superRefine((answers, ctx) => {
    for (const q of questions) {
      const matching = answers.filter((a) => a.questionKey === q.key)
      if (matching.length !== 1) {
        ctx.addIssue({ code: 'custom', message: `Question ${q.key} must be answered exactly once` })
        continue
      }
      const values = matching[0]!.values
      const valid = new Set(q.options.map((o) => o.value))
      if (values.some((v) => !valid.has(v)) || new Set(values).size !== values.length) {
        ctx.addIssue({ code: 'custom', message: `Invalid option for ${q.key}` })
      }
      const max = q.type === 'single' ? 1 : (q.max ?? q.options.length)
      if (values.length > max) ctx.addIssue({ code: 'custom', message: `Too many options for ${q.key}` })
    }
    if (answers.length !== questions.length) ctx.addIssue({ code: 'custom', message: 'Unknown question in answers' })
  })

/**
 * Stores raw answers and the derived result together. Nested writes run in a
 * single transaction: a diagnosis never exists without its answers and result.
 */
export async function createDiagnosis(input: unknown): Promise<string> {
  const answers = answersSchema.parse(input)
  const { products, conflicts } = await getCatalog()
  const result = diagnose(answers, questions, products.map(toEngineProduct), toEngineConflicts(conflicts))

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
 * Reads a stored result. The routine is read as saved, not recomputed: the
 * link shows the same routine on any device, and a rule change later does not
 * silently rewrite what someone was told.
 */
export const getDiagnosisResult = cache(async (id: string) => {
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
    ruleVersion: diagnosis.ruleVersion,
    createdAt: diagnosis.createdAt,
    answers: diagnosis.answers.map((a) => ({ questionKey: a.questionKey, values: a.values })),
    skinType: diagnosis.result.skinTypeSlug,
    interpretation,
    attributes: attributes as Record<string, number>,
    routine: diagnosis.result.routine as unknown as Routine,
  }
})
