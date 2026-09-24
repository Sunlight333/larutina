// "Aparece en estas rutinas" (product page block 9), computed rather than
// written: run the real engine over every skin type × concern × routine size
// and record where each product lands. If the rules change, this block changes
// with them.
import { generateRoutine, type EngineConflict, type EngineProduct, type Interpretation } from '@/lib/diagnosis/engine'

export const SKIN_TYPES = ['seca', 'grasa', 'mixta', 'normal', 'sensible'] as const
export const CONCERNS = ['acne', 'manchas', 'deshidratacion', 'sensibilidad', 'lineas', 'poros'] as const

export type Appearance = { skinType: string; concern: string; steps: Interpretation['steps']; slot: 'AM' | 'PM' }

export function routineCoverage(products: EngineProduct[], conflicts: EngineConflict[]) {
  const byProduct = new Map<string, Appearance[]>()
  let total = 0
  for (const skinType of SKIN_TYPES) {
    for (const concern of CONCERNS) {
      for (const steps of ['basic', 'complete'] as const) {
        const interp: Interpretation = { skinType, sensitive: skinType === 'sensible', concerns: [{ slug: concern, score: 3 }], steps }
        const routine = generateRoutine(interp, products, conflicts)
        total++
        for (const [slot, list] of [['AM', routine.am], ['PM', routine.pm]] as const) {
          for (const step of list) {
            const seen = byProduct.get(step.productId) ?? []
            seen.push({ skinType, concern, steps, slot })
            byProduct.set(step.productId, seen)
          }
        }
      }
    }
  }
  return { total, byProduct }
}

/** Summarises one product's appearances: routines counted once, not per slot. */
export function summariseCoverage(appearances: Appearance[]) {
  const routines = new Set(appearances.map((a) => `${a.skinType}|${a.concern}|${a.steps}`))
  const bySkin = new Map<string, Set<string>>()
  const slots = new Set<string>()
  for (const a of appearances) {
    if (!bySkin.has(a.skinType)) bySkin.set(a.skinType, new Set())
    bySkin.get(a.skinType)!.add(a.concern)
    slots.add(a.slot)
  }
  const skins = [...bySkin.entries()]
    .map(([skinType, concerns]) => ({ skinType, concerns: CONCERNS.filter((c) => concerns.has(c)) }))
    .sort((a, b) => b.concerns.length - a.concerns.length || SKIN_TYPES.indexOf(a.skinType as never) - SKIN_TYPES.indexOf(b.skinType as never))
  const concernCounts = new Map<string, number>()
  for (const s of skins) for (const c of s.concerns) concernCounts.set(c, (concernCounts.get(c) ?? 0) + 1)
  const topConcerns = [...concernCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  return { routineCount: routines.size, skins, topConcerns, slots: [...slots] as ('AM' | 'PM')[] }
}
