// Answer validation and the compact answer code used in result links when no
// database is connected. Pure: shared by the server action, the result page
// and the tests.
import { z } from 'zod'
import type { Answer } from './engine'
import { questions, RULE_VERSION } from './questions'

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
 * Answers as a short code: rule version, then each question's option indexes
 * in order, e.g. "v1-1-2-03-0-2-1". The engine is deterministic, so the same
 * code gives the same routine on any device.
 */
export function encodeAnswers(answers: Answer[]): string {
  const parts = questions.map((q) => {
    const values = answers.find((a) => a.questionKey === q.key)?.values ?? []
    return values.map((v) => q.options.findIndex((o) => o.value === v)).join('')
  })
  return `v${RULE_VERSION}-${parts.join('-')}`
}

/** Returns null for anything that is not a valid code for the current rules. */
export function decodeAnswers(code: string): Answer[] | null {
  const match = new RegExp(`^v${RULE_VERSION}-([0-9-]+)$`).exec(code)
  if (!match) return null
  const parts = match[1]!.split('-')
  if (parts.length !== questions.length) return null
  const answers = questions.map((q, i) => ({
    questionKey: q.key,
    values: [...parts[i]!].map((d) => q.options[Number(d)]?.value ?? ''),
  }))
  return answersSchema.safeParse(answers).success ? answers : null
}
