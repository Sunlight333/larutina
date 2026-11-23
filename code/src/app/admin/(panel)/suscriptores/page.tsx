import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { subscriberCounts } from '@/server/services/content/subscribers'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Card, PageHeader, Stat, adminButton, formatDateTime } from '@/components/admin/ui'
import { unsubscribeAction } from './actions'

export const metadata = { title: 'Lista de espera y newsletter' }

export default async function SubscribersPage() {
  await requireAdmin('subscribers.export')
  const db = getDb()
  const [counts, latest] = await Promise.all([subscriberCounts(db), db.waitlistSignup.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })])
  return (
    <>
      <PageHeader title="Lista de espera y newsletter" description="Los emails con el texto de consentimiento que aceptó cada persona. Se exportan en CSV para la herramienta de email." />
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Lista de espera" value={counts.waitlist} />
          <Stat label="Sin exportar todavía" value={counts.waitlistNew} />
          <Stat label="Newsletter activas" value={counts.newsletter} />
          <Stat label="Bajas del newsletter" value={counts.unsubscribed} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Exportar" description="CSV en UTF-8, se abre con Excel o Google Sheets. Exportar la lista de espera marca esas filas como exportadas.">
            {/* Plain links, not next/link: a prefetch must never trigger an export. */}
            <div className="flex flex-wrap gap-2">
              <a href="/admin/exportar/lista-de-espera?solo-nuevos=1" className={adminButton('primary')} download>
                Lista de espera: solo nuevos
              </a>
              <a href="/admin/exportar/lista-de-espera" className={adminButton('secondary')} download>
                Lista de espera: todo
              </a>
              <a href="/admin/exportar/newsletter" className={adminButton('secondary')} download>
                Newsletter
              </a>
            </div>
          </Card>
          <Card title="Dar de baja del newsletter" description="Cuando alguien lo pide por otro canal. Queda registrado y no vuelve a exportarse.">
            <AdminForm action={unsubscribeAction} submitLabel="Dar de baja" resetOnSuccess>
              <TextField name="email" label="Email" type="email" required />
            </AdminForm>
          </Card>
        </div>
        <Card title="Últimas en la lista de espera">
          <DataTable
            rows={latest}
            rowKey={(r) => r.id}
            empty="Todavía no hay inscripciones."
            columns={[
              { key: 'email', label: 'Email', render: (r) => r.email },
              { key: 'date', label: 'Fecha', render: (r) => formatDateTime(r.createdAt) },
              { key: 'exported', label: 'Exportada', render: (r) => (r.exportedAt ? formatDateTime(r.exportedAt) : '—') },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
