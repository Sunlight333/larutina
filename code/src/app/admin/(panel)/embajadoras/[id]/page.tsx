import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { suggestCode } from '@/server/ambassadors/program'
import { getSettings } from '@/server/settings'
import { formatARS } from '@/lib/money'
import { formatCuit } from '@/lib/argentina'
import { AdminForm } from '@/components/admin/form'
import { TextArea, TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Badge, Card, DefinitionList, PageHeader, formatDate, formatDateTime } from '@/components/admin/ui'
import { approveAction, leaveAction, noteAction, rejectAction } from '../actions'
import { AMB_STATUS } from '../status'

export const metadata = { title: 'Embajadora' }

const C_STATUS = { PENDING: 'Pendiente', APPROVED: 'Aprobada', PAID: 'Pagada', CANCELLED: 'Anulada' } as const
const SOURCE = { CODE: 'Código', CART: 'Link (guardado en el carrito)', COOKIE: 'Link (en el dispositivo)', ACCOUNT: 'Link (en la cuenta)' } as const

export default async function AmbassadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('ambassadors.manage')
  const { id } = await params
  const db = getDb()
  const a = await db.ambassador.findUnique({ where: { id } })
  if (!a) notFound()
  const [commissions, s, visits] = await Promise.all([
    db.commission.findMany({ where: { ambassadorId: id }, orderBy: { createdAt: 'desc' }, take: 100, include: { order: { select: { id: true, number: true, placedAt: true, attribution: { select: { source: true } } } } } }),
    getSettings(),
    db.referralVisit.count({ where: { ambassadorId: id } }),
  ])
  const suggested = a.code ?? (await suggestCode(db, a.firstName, a.lastName))
  return (
    <>
      <PageHeader title={`${a.firstName} ${a.lastName}`} description={<Badge tone={AMB_STATUS[a.status].tone}>{AMB_STATUS[a.status].label}</Badge>} back={{ href: '/embajadoras', label: 'Embajadoras' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Postulación">
            <DefinitionList
              items={[
                ['Recibida', formatDateTime(a.createdAt)],
                ['Email', <a key="e" href={`mailto:${a.email}`} className="underline underline-offset-2">{a.email}</a>],
                ['Teléfono', a.phone],
                ['Profesión', a.profession],
                ['Matrícula o título', a.license ?? '—'],
                ['Archivo', a.licenseFile ? <a key="f" href={`/postulaciones/${a.id}/archivo`} target="_blank" rel="noopener" className="underline underline-offset-2">Ver archivo</a> : '—'],
                ['Ciudad', a.city],
                ['Dónde atiende', a.workplaces.join(', ') || '—'],
                ['Instagram o web', a.social ?? '—'],
                ['Aceptó Privacidad', a.privacyVersion ? `v${a.privacyVersion}` : 'sí (sin versión publicada)'],
              ]}
            />
            <p className="mt-5 whitespace-pre-wrap border-t border-line pt-5 text-sm leading-relaxed">{a.motivation}</p>
          </Card>
          <Card title="Ventas y comisiones" description={`Visitas con su link: ${visits}. Nunca ve datos de las clientas (EB-C09).`}>
            <DataTable
              rows={commissions}
              rowKey={(c) => c.id}
              empty="Todavía no hay ventas."
              columns={[
                { key: 'd', label: 'Fecha', render: (c) => formatDate(c.order.placedAt) },
                { key: 'o', label: 'Pedido', render: (c) => <a href={`/pedidos/${c.order.id}`} className="underline underline-offset-2">#{c.order.number}</a> },
                { key: 's', label: 'Por', render: (c) => (c.order.attribution ? SOURCE[c.order.attribution.source] : '—') },
                { key: 'b', label: 'Base', render: (c) => <span className="tabular">{formatARS(c.baseCents)}</span> },
                { key: 'a', label: 'Comisión', render: (c) => <span className="tabular">{formatARS(c.amountCents)}</span> },
                { key: 'st', label: 'Estado', render: (c) => C_STATUS[c.status] },
              ]}
            />
          </Card>
        </div>
        <div className="space-y-6">
          {(a.status === 'PENDING' || a.status === 'APPROVED' || a.status === 'REJECTED') && (
            <Card title={a.status === 'APPROVED' ? 'Datos de embajadora' : 'Aprobar'}>
              <AdminForm action={approveAction.bind(null, a.id)} submitLabel={a.status === 'APPROVED' ? 'Guardar' : 'Aprobar'}>
                <TextField name="code" label="Código" defaultValue={suggested} help="Su link: /?ref=CÓDIGO y /r/CÓDIGO." />
                <TextField name="commissionPct" label="Comisión propia (%)" defaultValue={a.commissionPct != null ? Number(a.commissionPct) : ''} help={`Vacío: la general (${s['ambassadors.commissionPct']}%). Cambiarla no toca lo ya generado.`} />
                <TextField name="customerDiscountPct" label="Descuento que da su código (%)" type="number" defaultValue={a.customerDiscountPct ?? ''} help={`Vacío: el general (${s['ambassadors.customerDiscountPct']}%).`} />
                <TextField name="cuit" label="CUIT" defaultValue={a.cuit ? formatCuit(a.cuit) : ''} help="Para la factura y para que sus propias compras no sumen comisión." />
                <TextField name="payoutAccount" label="CBU o alias a su nombre" defaultValue={a.payoutAccount} />
              </AdminForm>
            </Card>
          )}
          {a.status === 'PENDING' && (
            <Card title="No aprobar">
              <AdminForm action={rejectAction.bind(null, a.id)} submitLabel="No aprobar">
                <TextField name="reason" label="Motivo breve (opcional)" help="Va en el email. Siempre sobre el programa, nunca sobre la persona (EM-17)." />
              </AdminForm>
            </Card>
          )}
          {a.status === 'APPROVED' && (
            <Card title="Dar de baja">
              <AdminForm action={leaveAction.bind(null, a.id)} submitLabel="Dar de baja">
                <p className="text-sm text-ink-muted">Su código deja de funcionar. Lo aprobado y lo pendiente que se apruebe se le sigue pagando (EB-C10).</p>
              </AdminForm>
            </Card>
          )}
          <Card title="Nota interna">
            <AdminForm action={noteAction.bind(null, a.id)}>
              <TextArea name="note" label="Nota" defaultValue={a.note} rows={3} />
            </AdminForm>
          </Card>
        </div>
      </div>
    </>
  )
}
