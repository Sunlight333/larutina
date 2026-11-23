import type { Concern } from '@prisma/client'
import { TextArea, TextField } from '@/components/admin/fields'

export function ConcernFields({ concern }: { concern?: Concern }) {
  return (
    <>
      <TextField name="name" label="Nombre" defaultValue={concern?.name} required />
      <TextField name="shortLabel" label="Etiqueta corta" defaultValue={concern?.shortLabel} required maxLength={18} help="Hasta 18 caracteres: chips y filtros." />
      <TextArea name="shortDescription" label="Descripción corta" defaultValue={concern?.shortDescription} rows={2} />
      <TextArea name="editorialContent" label="Contenido editorial" defaultValue={concern?.editorialContent} rows={8} help="La introducción de la página de la necesidad." />
    </>
  )
}
