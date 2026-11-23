import { Checkbox, TextField } from '@/components/admin/fields'
import { toArgentinaInput } from '@/server/services/content/announcements'

// The fields of an announcement, shared by the create and edit forms.
export function AnnouncementFields({ value }: { value?: { text: string; href: string | null; startsAt: Date | null; endsAt: Date | null; active: boolean } }) {
  return (
    <>
      <TextField name="text" label="Mensaje" defaultValue={value?.text} required maxLength={160} help="Corto: entra en una línea del celular. Podés usar variables, como {envio_gratis_desde}." />
      <TextField name="href" label="Link (opcional)" defaultValue={value?.href} placeholder="/productos" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="startsAt" label="Desde (opcional)" type="datetime-local" defaultValue={toArgentinaInput(value?.startsAt)} help="Hora de Argentina." />
        <TextField name="endsAt" label="Hasta (opcional)" type="datetime-local" defaultValue={toArgentinaInput(value?.endsAt)} />
      </div>
      <Checkbox name="active" label="Activo" defaultChecked={value?.active ?? true} />
    </>
  )
}
