// Dev helper: prints routines for a few profiles, to read them as a skincare advisor would.
import { diagnose, type Answer } from '../../src/lib/diagnosis/engine'
import { questions } from '../../src/lib/diagnosis/questions'
import { engineConflicts, engineProducts } from './fixtures'

const profiles: Record<string, Record<string, string | string[]>> = {
  'mixta, poros + manchas, completa': { skin_feel_midday: 'shiny_tzone', breakouts: 'monthly', goals: ['poros', 'manchas'], reaction: 'none', after_wash: 'fine', routine_size: 'complete' },
  'seca sensible, rojeces, completa': { skin_feel_midday: 'tight_flaky', breakouts: 'rarely', goals: ['sensibilidad'], reaction: 'burns', after_wash: 'tight', routine_size: 'complete' },
  'grasa, acné, completa': { skin_feel_midday: 'shiny_all', breakouts: 'often', goals: ['poros'], reaction: 'none', after_wash: 'shiny_soon', routine_size: 'complete' },
  'normal, líneas + manchas, completa': { skin_feel_midday: 'comfortable', breakouts: 'rarely', goals: ['lineas', 'manchas'], reaction: 'none', after_wash: 'fine', routine_size: 'complete' },
  'seca, líneas, básica': { skin_feel_midday: 'tight_flaky', breakouts: 'rarely', goals: ['lineas'], reaction: 'sometimes_red', after_wash: 'tight', routine_size: 'basic' },
  'mixta sensible, acné + rojeces, completa': { skin_feel_midday: 'shiny_tzone', breakouts: 'often', goals: ['sensibilidad'], reaction: 'burns', after_wash: 'shiny_soon', routine_size: 'complete' },
}
const name = (id: string) => engineProducts.find((p) => p.id === id)!.name
for (const [label, a] of Object.entries(profiles)) {
  const answers: Answer[] = Object.entries(a).map(([questionKey, v]) => ({ questionKey, values: Array.isArray(v) ? v : [v] }))
  const r = diagnose(answers, questions, engineProducts, engineConflicts)
  console.log(`\n## ${label} → ${r.interpretation.skinType}${r.interpretation.sensitive ? ' (sensible)' : ''}, ${r.interpretation.concerns.map((c) => `${c.slug}:${c.score}`).join(', ')}`)
  for (const [slot, steps] of [['AM', r.routine.am], ['PM', r.routine.pm]] as const) {
    for (const s of steps) console.log(`  ${slot} ${s.stepType.padEnd(11)} ${name(s.productId).padEnd(34)} ${String(s.score).padStart(4)}  ${s.explanation}${s.frequency ? `  [${s.frequency}]` : ''}`)
  }
  if (r.routine.notes.length) console.log(`  notes: ${r.routine.notes.join(' | ')}`)
}
