import type { Coupon } from '@prisma/client'
import { AdminForm } from '@/components/admin/form'
import { Checkbox, Select, TextField } from '@/components/admin/fields'
import { saveCouponAction } from './actions'

const day = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d) : '')
const pesos = (cents: number | null | undefined) => (cents == null ? '' : String(cents / 100))

export function CouponForm({ coupon }: { coupon?: Coupon }) {
  return (
    <AdminForm action={saveCouponAction.bind(null, coupon?.id ?? null)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="code" label="Código" defaultValue={coupon?.code} required help="Lo que escribe la clienta. Se guarda en mayúsculas." />
        <TextField name="description" label="Descripción interna" defaultValue={coupon?.description} />
        <Select
          name="kind"
          label="Tipo"
          defaultValue={coupon?.kind ?? 'PERCENT'}
          options={[
            { value: 'PERCENT', label: 'Porcentaje' },
            { value: 'AMOUNT', label: 'Monto fijo' },
          ]}
        />
        <TextField name="value" label="Valor" defaultValue={coupon ? (coupon.kind === 'AMOUNT' ? pesos(coupon.value) : coupon.value) : ''} required help="Porcentaje (1 a 100) o pesos, según el tipo." />
        <TextField name="startsAt" label="Desde (opcional)" type="date" defaultValue={day(coupon?.startsAt)} />
        <TextField name="endsAt" label="Hasta, inclusive (opcional)" type="date" defaultValue={day(coupon?.endsAt)} />
        <TextField name="minSubtotal" label="Compra mínima en pesos (opcional)" defaultValue={pesos(coupon?.minSubtotalCents)} />
        <TextField name="maxUses" label="Usos en total (opcional)" type="number" defaultValue={coupon?.maxUses} help="Un pedido sin pagar reserva su uso hasta que se paga o se cancela." />
      </div>
      <Checkbox name="firstPurchaseOnly" label="Solo primera compra (por email o DNI)" defaultChecked={coupon?.firstPurchaseOnly} />
      <Checkbox name="combinesWithTransfer" label="Se suma al descuento por transferencia" defaultChecked={coupon?.combinesWithTransfer ?? true} />
      <Checkbox name="active" label="Activo" defaultChecked={coupon?.active ?? true} />
      <p className="text-sm text-ink-muted">Entre el descuento de una rutina y el de un código se aplica el mayor, y el total nunca pasa el tope de Configuración (CMP-02).</p>
    </AdminForm>
  )
}
