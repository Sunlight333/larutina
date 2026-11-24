'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { bool, fail, fromZod, int, ok, optStr, str, type FormState } from '@/server/admin/forms'
import { routineSchema, saveRoutine } from '@/server/services/admin/routines'

const MAX_STEPS = 20

export async function saveRoutineAction(existing: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const rows: { order: number; data: unknown }[] = []
  for (let i = 0; i < MAX_STEPS; i++) {
    const main = str(form, `step.${i}.main`)
    if (!main) continue // an empty row, or a step removed by clearing its product
    rows.push({
      order: Number(str(form, `step.${i}.order`)) || i + 1,
      data: {
        moment: str(form, `step.${i}.moment`) || 'BOTH',
        stepType: str(form, `step.${i}.type`),
        title: str(form, `step.${i}.title`),
        mainProduct: main,
        alternatives: str(form, `step.${i}.alternatives`)
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        instruction: optStr(form, `step.${i}.instruction`),
        frequency: optStr(form, `step.${i}.frequency`),
        optional: bool(form, `step.${i}.optional`),
      },
    })
  }
  const discount = int(form, 'discountPct')
  const parsed = routineSchema.safeParse({
    code: str(form, 'code'),
    name: str(form, 'name'),
    goal: str(form, 'goal'),
    moment: str(form, 'moment') || 'BOTH',
    difficulty: optStr(form, 'difficulty'),
    discountPct: discount,
    discountHalves: bool(form, 'discountHalves'),
    description: optStr(form, 'description'),
    status: str(form, 'status') === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    skinTypes: form.getAll('skinTypes').map(String),
    concerns: form.getAll('concerns').map(String),
    steps: rows.sort((a, b) => a.order - b.order).map((r) => r.data),
  })
  if (!parsed.success) return fromZod(parsed.error)
  const r = await saveRoutine(getDb(), admin, existing, parsed.data)
  if (!r.ok) return fail(r.error, r.field ? { [r.field]: r.error } : undefined)
  revalidatePath('/admin/rutinas')
  revalidatePath('/rutinas')
  if (existing !== r.code) redirect(`/rutinas/${r.code}`)
  return ok(r.warnings.length ? `Guardado, con ${r.warnings.length} ${r.warnings.length === 1 ? 'aviso' : 'avisos'} (abajo).` : 'Guardado. Sin avisos.')
}
