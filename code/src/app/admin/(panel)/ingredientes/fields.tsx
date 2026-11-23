import type { Ingredient } from '@prisma/client'
import { Checkbox, MultiCheck, Select, TextArea, TextField } from '@/components/admin/fields'

type Option = { value: string; label: string }

export function IngredientFields({ ingredient, families, concerns, concernIds = [] }: { ingredient?: Ingredient; families: Option[]; concerns: Option[]; concernIds?: string[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="commonName" label="Nombre común" defaultValue={ingredient?.commonName} required />
        <TextField name="inciName" label="Nombre INCI" defaultValue={ingredient?.inciName} required help="Con este nombre se asocian las listas INCI." />
      </div>
      <Select name="familyId" label="Familia" options={families} defaultValue={ingredient?.familyId} allowEmpty="Sin familia" help="Calcula los indicadores (sin fragancia, contiene retinoide…) y suma su advertencia." />
      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox name="isKeyActive" label="Activo clave" defaultChecked={ingredient?.isKeyActive} help="En el catálogo completo necesita descripción." />
        <Checkbox name="isIrritant" label="Irritante" defaultChecked={ingredient?.isIrritant} />
      </div>
      <TextArea name="description" label="Descripción" defaultValue={ingredient?.description} rows={4} />
      {concerns.length > 0 && <MultiCheck name="concernIds" label="Necesidades que trata" options={concerns} defaultValues={concernIds} />}
    </>
  )
}
