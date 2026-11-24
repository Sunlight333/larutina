import type { Concern, SkinType } from '@prisma/client'
import { STEP_LABELS } from '@/server/services/catalog/labels'
import { AdminForm } from '@/components/admin/form'
import { Checkbox, MultiCheck, Select, TextArea, TextField } from '@/components/admin/fields'
import { saveRoutineAction } from './actions'

export type EditableRoutine = {
  code: string
  name: string
  goal: string
  moment: string
  difficulty: string | null
  discountPct: number | null
  discountHalves: boolean
  description: string | null
  status: string
  skinTypes: string[]
  concerns: string[]
  steps: { moment: string; stepType: string; title: string; mainProduct: string; alternatives: string[]; instruction: string | null; frequency: string | null; optional: boolean }[]
}

const MOMENTS = [
  { value: 'AM', label: 'Mañana' },
  { value: 'PM', label: 'Noche' },
  { value: 'BOTH', label: 'Mañana y noche' },
]

export function RoutineForm({ routine, skinTypes, concerns }: { routine?: EditableRoutine; skinTypes: SkinType[]; concerns: Concern[] }) {
  const steps = [...(routine?.steps ?? []), ...Array.from({ length: 3 }, () => null)]
  return (
    <AdminForm action={saveRoutineAction.bind(null, routine?.code ?? null)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Nombre" defaultValue={routine?.name} required />
        <TextField name="code" label="Código" defaultValue={routine?.code} required help="Va en la dirección: /rutinas/<código>." />
        <TextField name="goal" label="Para quién, en una línea" defaultValue={routine?.goal} required help="RU-04: la línea de la card." />
        <Select name="status" label="Estado" defaultValue={routine?.status ?? 'DRAFT'} options={[{ value: 'DRAFT', label: 'Borrador' }, { value: 'PUBLISHED', label: 'Publicada' }]} />
        <Select name="moment" label="Momento" defaultValue={routine?.moment ?? 'BOTH'} options={MOMENTS} />
        <Select name="difficulty" label="Dificultad" defaultValue={routine?.difficulty} allowEmpty="Sin definir" options={[{ value: 'BASIC', label: 'Básica' }, { value: 'INTERMEDIATE', label: 'Intermedia' }, { value: 'COMPLETE', label: 'Completa' }]} />
        <TextField name="discountPct" label="Descuento por llevarla (%)" type="number" defaultValue={routine?.discountPct ?? ''} help="0 o vacío: sin descuento ni línea de ahorro (RU-04)." />
        <div className="self-end pb-1">
          <Checkbox name="discountHalves" label="También por mitad (solo la mañana o solo la noche)" defaultChecked={routine?.discountHalves} />
        </div>
      </div>
      <TextArea name="description" label="Descripción" defaultValue={routine?.description} rows={4} />
      <div className="grid gap-5 sm:grid-cols-2">
        <MultiCheck name="skinTypes" label="Tipos de piel" defaultValues={routine?.skinTypes} options={skinTypes.map((s) => ({ value: s.code, label: s.name }))} />
        <MultiCheck name="concerns" label="Lo que mejora" defaultValues={routine?.concerns} options={concerns.map((c) => ({ value: c.code, label: c.name }))} />
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Pasos</legend>
        <p className="text-sm text-ink-muted">Productos por su código. Para sacar un paso, borrá su producto. Para ordenarlos, cambiá el número de orden.</p>
        {steps.map((s, i) => (
          <div key={i} className={`rounded-xl border p-4 ${s ? 'border-line' : 'border-dashed border-line-strong'}`}>
            <div className="grid gap-4 sm:grid-cols-4">
              <TextField name={`step.${i}.order`} label="Orden" type="number" defaultValue={i + 1} />
              <Select name={`step.${i}.moment`} label="Momento" defaultValue={s?.moment ?? 'BOTH'} options={MOMENTS} />
              <Select name={`step.${i}.type`} label="Tipo de paso" defaultValue={s?.stepType} allowEmpty="El del producto" options={Object.entries(STEP_LABELS).map(([value, label]) => ({ value, label }))} />
              <TextField name={`step.${i}.title`} label="Título" defaultValue={s?.title} help="Por qué está en esta rutina (RU-06)." />
              <TextField name={`step.${i}.main`} label="Producto principal (código)" defaultValue={s?.mainProduct} />
              <TextField name={`step.${i}.alternatives`} label="Alternativas (hasta 2, separadas por ;)" defaultValue={s?.alternatives.join('; ')} />
              <TextField name={`step.${i}.frequency`} label="Frecuencia (si no es diario)" defaultValue={s?.frequency} help="Por ejemplo: noches alternas." />
              <div className="self-end pb-1">
                <Checkbox name={`step.${i}.optional`} label="Opcional" defaultChecked={s?.optional} />
              </div>
            </div>
            <div className="mt-4">
              <TextArea name={`step.${i}.instruction`} label="Cómo usarlo en esta rutina" defaultValue={s?.instruction} rows={2} />
            </div>
          </div>
        ))}
      </fieldset>
    </AdminForm>
  )
}
