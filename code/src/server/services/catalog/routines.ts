// Read-only routines for /rutinas until the routine pages arrive (RUT-01,
// Phase 3): published routines with their steps and products.
import type { Moment, RoutineDifficulty } from '@prisma/client'
import { getDb } from '@/server/db'
import { getCatalog, type CatalogItem } from './catalog'
import { MOMENT_LABELS, STEP_LABELS } from './labels'
import { paragraphs } from './rules'

const DIFFICULTY: Record<RoutineDifficulty, string> = { BASIC: 'Básica', INTERMEDIATE: 'Intermedia', COMPLETE: 'Completa' }

export type RoutineStepView = {
  position: number
  moment: Moment
  momentLabel: string
  stepLabel: string
  title: string
  instruction: string | null
  frequency: string | null
  optional: boolean
  /** Null when the product is not published: the step shows without it. */
  product: CatalogItem | null
}

export type RoutineView = {
  code: string
  name: string
  goal: string
  momentLabel: string
  difficulty: string | null
  description: string[]
  skinTypes: string[]
  concerns: { code: string; name: string }[]
  steps: RoutineStepView[]
}

export async function getPublishedRoutines(): Promise<RoutineView[]> {
  const [rows, catalog] = await Promise.all([
    getDb().routine.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: {
        steps: { orderBy: { position: 'asc' }, include: { mainProduct: { select: { code: true } } } },
        skinTypes: { include: { skinType: { select: { name: true, deletedAt: true } } } },
        concerns: { include: { concern: { select: { code: true, name: true, deletedAt: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    getCatalog(),
  ])
  const byCode = new Map(catalog.map((p) => [p.code, p]))
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    goal: r.goal,
    momentLabel: MOMENT_LABELS[r.moment],
    difficulty: r.difficulty ? DIFFICULTY[r.difficulty] : null,
    description: paragraphs(r.description),
    skinTypes: r.skinTypes.filter((s) => !s.skinType.deletedAt).map((s) => s.skinType.name),
    concerns: r.concerns.filter((c) => !c.concern.deletedAt).map((c) => ({ code: c.concern.code, name: c.concern.name })),
    steps: r.steps.map((s) => ({
      position: s.position,
      moment: s.moment,
      momentLabel: MOMENT_LABELS[s.moment],
      stepLabel: STEP_LABELS[s.stepType],
      title: s.title,
      instruction: s.instruction,
      frequency: s.frequency,
      optional: s.optional,
      product: byCode.get(s.mainProduct.code) ?? null,
    })),
  }))
}
