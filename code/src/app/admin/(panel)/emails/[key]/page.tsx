import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { emailTemplateDef } from '@/server/email/templates'
import { renderEmail } from '@/server/email/render'
import { emailFrame } from '@/server/email'
import { getSettings } from '@/server/settings'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextArea, TextField } from '@/components/admin/fields'
import { Card, PageHeader } from '@/components/admin/ui'
import { saveEmailAction } from '../actions'

export const metadata = { title: 'Email' }

// Sample values so the preview reads like a real email.
const SAMPLE: Record<string, string> = {
  nombre: 'Ana',
  numero: 'LR-000142',
  total: '$ 42.300',
  hora: '18:30',
  horas: '6',
  dia: '24 de noviembre',
  motivo: 'No recibimos la transferencia a tiempo.',
  devolucion: '',
  correo: 'Correo Argentino',
  dias_min: '2',
  dias_max: '4',
  seguimiento: 'CA123456789AR',
  producto: 'Sérum de niacinamida',
  monto: '$ 18.900',
  medio: 'Mercado Pago',
  plazo: 'unos días hábiles',
  productos_carrito: 'Sérum de niacinamida y Gel limpiador',
  codigo: 'ARR-7K2M9Q',
  contacto: 'ana@mail.com',
  link_pedido: 'https://larutinabeauty.com/pedido/LR-000142',
}

export default async function EmailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin('emails.edit')
  const { key } = await params
  const def = emailTemplateDef(key)
  if (!def) notFound()
  const [override, s] = await Promise.all([getDb().emailTemplate.findUnique({ where: { key } }), getSettings()])
  const content = override ? { subject: override.subject, preheader: override.preheader, body: override.body, ctaLabel: override.ctaLabel, marketing: def.marketing } : def
  const preview = renderEmail(content, { marca: s['brand.name'], ...SAMPLE }, emailFrame(s, '/'), {
    detalle: { lines: [{ name: 'Sérum de niacinamida', brand: 'Marca', size: '30 ml', quantity: 1, totalCents: 1_890_000 }], subtotalCents: 1_890_000, discountCents: 0, shippingCents: 500_000, totalCents: 2_390_000 },
    datos_bancarios: { holder: s['company.bankHolder'] || 'Titular (pendiente)', cuit: s['company.cuit'] || '—', bank: s['company.bankName'] || '—', cbu: s['company.bankCbu'] || '—', alias: s['company.bankAlias'] || '—' },
  })
  return (
    <>
      <PageHeader title={def.label} description={`Fila ${def.code} del archivo de contenidos.`} back={{ href: '/emails', label: 'Emails' }} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <AdminForm
            action={saveEmailAction.bind(null, def.key)}
            extraButtons={override ? <SubmitButton name="do" value="restore" variant="ghost" confirm="¿Volver al texto original?">Volver al original</SubmitButton> : undefined}
          >
            <TextField name="subject" label="Asunto" defaultValue={content.subject} required />
            <TextField name="preheader" label="Preheader" defaultValue={content.preheader} help="La línea que se ve al lado del asunto en la bandeja." />
            <TextArea name="body" label="Cuerpo" defaultValue={content.body} rows={10} help="Negrita con **texto**, links con [texto](https://…). Una línea con {detalle} o {datos_bancarios} muestra ese bloque." />
            <TextField name="ctaLabel" label="Botón" defaultValue={content.ctaLabel} help="Vacío: sin botón." />
            <p className="text-sm text-ink-muted">
              Variables: {def.variables.map((v) => `{${v}}`).join(' · ')}
            </p>
          </AdminForm>
        </Card>
        <Card title="Vista previa" description="Con datos de ejemplo.">
          <iframe title="Vista previa del email" srcDoc={preview.html} sandbox="" className="h-[44rem] w-full rounded-lg border border-line bg-shell" />
        </Card>
      </div>
    </>
  )
}
