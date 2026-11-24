import type { ShippingBox, ShippingRate } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { PROVINCE_OPTIONS } from '@/lib/argentina'
import { formatARS } from '@/lib/money'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Checkbox, MultiCheck, TextField } from '@/components/admin/fields'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { saveBoxAction, saveRateAction } from './actions'

export const metadata = { title: 'Cajas y tarifas de envío' }

function BoxForm({ box }: { box?: ShippingBox }) {
  return (
    <AdminForm
      action={saveBoxAction.bind(null, box?.id ?? null)}
      submitLabel={box ? 'Guardar' : 'Agregar caja'}
      resetOnSuccess={!box}
      extraButtons={box ? <SubmitButton name="do" value="delete" variant="ghost" confirm="¿Eliminar esta caja?">Eliminar</SubmitButton> : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="name" label="Nombre" defaultValue={box?.name} required />
        <TextField name="code" label="Código" defaultValue={box?.code} required help="Minúsculas, por ejemplo caja-chica." />
        <TextField name="emptyWeightGrams" label="Peso vacía (g)" type="number" defaultValue={box?.emptyWeightGrams ?? 0} />
        <TextField name="heightCm" label="Alto interior (cm)" defaultValue={box ? Number(box.heightCm) : ''} required />
        <TextField name="widthCm" label="Ancho interior (cm)" defaultValue={box ? Number(box.widthCm) : ''} required />
        <TextField name="lengthCm" label="Largo interior (cm)" defaultValue={box ? Number(box.lengthCm) : ''} required />
        <TextField name="maxWeightGrams" label="Peso máximo (g, opcional)" type="number" defaultValue={box?.maxWeightGrams} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="isDefault" label="Caja por defecto (productos sin medidas)" defaultChecked={box?.isDefault} />
        <Checkbox name="active" label="Activa" defaultChecked={box?.active ?? true} />
      </div>
    </AdminForm>
  )
}

function RateForm({ rate }: { rate?: ShippingRate }) {
  return (
    <AdminForm
      action={saveRateAction.bind(null, rate?.id ?? null)}
      submitLabel={rate ? 'Guardar' : 'Agregar tarifa'}
      resetOnSuccess={!rate}
      extraButtons={rate ? <SubmitButton name="do" value="delete" variant="ghost" confirm="¿Eliminar esta tarifa?">Eliminar</SubmitButton> : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="zone" label="Zona" defaultValue={rate?.zone} required help="Por ejemplo AMBA, Centro, Patagonia." />
        <TextField name="carrier" label="Correo que ve la clienta" defaultValue={rate?.carrier} required />
        <TextField name="price" label="Precio en pesos" defaultValue={rate ? rate.priceCents / 100 : ''} required />
        <TextField name="minDays" label="Días hábiles, desde" type="number" defaultValue={rate?.minDays} required />
        <TextField name="maxDays" label="Días hábiles, hasta" type="number" defaultValue={rate?.maxDays} required />
        <TextField name="position" label="Orden" type="number" defaultValue={rate?.position ?? 0} help="Si una provincia está en dos zonas, gana la de menor orden." />
      </div>
      <MultiCheck name="provinces" label="Provincias de la zona" defaultValues={rate?.provinces} options={PROVINCE_OPTIONS} />
      <Checkbox name="active" label="Activa" defaultChecked={rate?.active ?? true} />
    </AdminForm>
  )
}

// ENV-03, ENV-04, CAT-11.
export default async function ShippingPage() {
  await requireAdmin('commerce.settings')
  const db = getDb()
  const [boxes, rates] = await Promise.all([db.shippingBox.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }), db.shippingRate.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })])
  const covered = new Set(rates.filter((r) => r.active).flatMap((r) => r.provinces))
  const missing = PROVINCE_OPTIONS.filter((p) => !covered.has(p.value))
  return (
    <>
      <PageHeader title="Cajas y tarifas de envío" description="Las cajas eligen cómo se cotiza cada pedido; las tarifas cotizan cuando el proveedor de envíos no responde o no está conectado." />
      {missing.length > 0 && (
        <div className="mb-6">
          <Notice tone="warning" title="Provincias sin tarifa de respaldo">
            {missing.map((p) => p.label).join(', ')}. Mientras el proveedor de envíos no esté conectado, a esas provincias no se les puede vender.
          </Notice>
        </div>
      )}
      <div className="space-y-6">
        <Card title="Cajas" description="El pedido va en la caja más chica en la que entra (ENV-04). Un producto sin medidas usa la caja por defecto (CAT-11).">
          <div className="space-y-6">
            {boxes.map((b) => (
              <div key={b.id} className="rounded-xl border border-line p-4">
                <BoxForm box={b} />
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-line-strong p-4">
              <p className="mb-3 text-sm font-medium">Nueva caja</p>
              <BoxForm />
            </div>
          </div>
        </Card>
        <Card title="Tarifas de respaldo" description="Por zona, editables. Si la API del proveedor falla, la compra sigue con estas (ENV-03).">
          <div className="space-y-6">
            {rates.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-4">
                <p className="mb-3 text-sm text-ink-muted">
                  {r.zone} · {r.carrier} · {formatARS(r.priceCents)}
                </p>
                <RateForm rate={r} />
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-line-strong p-4">
              <p className="mb-3 text-sm font-medium">Nueva tarifa</p>
              <RateForm />
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
