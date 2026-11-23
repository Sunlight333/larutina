import type { Synonym } from '@prisma/client'
import { SYNONYM_TYPES } from '@/server/services/admin/catalog/synonyms'
import { LinesField, Select, TextField } from '@/components/admin/fields'

export function SynonymFields({ synonym }: { synonym?: Synonym }) {
  return (
    <>
      <TextField name="term" label="Término" defaultValue={synonym?.term} required help="El concepto del catálogo, por ejemplo Sensible." />
      <Select name="type" label="Tipo" options={SYNONYM_TYPES} defaultValue={synonym?.type ?? 'SKIN_TYPE'} />
      <TextField name="targetCode" label="Código de destino" defaultValue={synonym?.targetCode} required help="El código del tipo de piel, necesidad, categoría, marca o ingrediente." />
      <LinesField name="variants" label="Sinónimos" defaultValues={synonym?.variants} required help="Formas de buscarlo, una por línea: colorada, irritada, me pica…" />
    </>
  )
}
