import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { getCopyVariables } from '@/server/services/site'
import { announcementState, type AnnouncementState } from '@/server/services/content/announcements'
import { VARIABLE_HELP } from '@/lib/copy-variables'
import { AdminForm } from '@/components/admin/form'
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from '@/components/admin/ui'
import { createAnnouncementAction, moveAnnouncementAction } from './actions'
import { AnnouncementFields } from './fields'

export const metadata = { title: 'Barra de anuncios' }

const STATE: Record<AnnouncementState, { label: string; tone: 'success' | 'neutral' | 'warning' | 'info' }> = {
  visible: { label: 'Se ve ahora', tone: 'success' },
  scheduled: { label: 'Programado', tone: 'info' },
  expired: { label: 'Vencido', tone: 'neutral' },
  inactive: { label: 'Inactivo', tone: 'neutral' },
  'waiting-value': { label: 'Oculto: falta un dato', tone: 'warning' },
}

export default async function AnnouncementsPage() {
  await requireAdmin('content.edit')
  const [rows, vars] = await Promise.all([getDb().announcement.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }), getCopyVariables()])
  return (
    <>
      <PageHeader title="Barra de anuncios" description="Mensajes que rotan arriba de todo el sitio, en este orden. Cada uno puede tener fechas de inicio y fin." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {rows.length === 0 ? (
            <EmptyState>Todavía no hay anuncios.</EmptyState>
          ) : (
            <ol className="space-y-2">
              {rows.map((a, i) => {
                const { state, missing } = announcementState(a, vars)
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/anuncios/${a.id}`} className="font-medium underline-offset-2 hover:underline">
                        {a.text}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {a.href ? `${a.href} · ` : ''}
                        {a.startsAt || a.endsAt ? `${a.startsAt ? `desde ${formatDateTime(a.startsAt)}` : ''}${a.startsAt && a.endsAt ? ' ' : ''}${a.endsAt ? `hasta ${formatDateTime(a.endsAt)}` : ''}` : 'Sin fechas'}
                        {missing.length > 0 && ` · sin valor: ${missing.map((m) => `{${m}}`).join(', ')}`}
                      </p>
                    </div>
                    <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
                    <form action={moveAnnouncementAction} className="flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <button name="dir" value="up" aria-label={`Subir "${a.text}"`} disabled={i === 0} className="rounded px-2 py-1 text-sm hover:bg-shell disabled:opacity-30">
                        ↑
                      </button>
                      <button name="dir" value="down" aria-label={`Bajar "${a.text}"`} disabled={i === rows.length - 1} className="rounded px-2 py-1 text-sm hover:bg-shell disabled:opacity-30">
                        ↓
                      </button>
                    </form>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Nuevo anuncio">
            <AdminForm action={createAnnouncementAction} submitLabel="Crear" resetOnSuccess>
              <AnnouncementFields />
            </AdminForm>
          </Card>
          <Card title="Variables">
            <p className="text-sm text-ink-muted">Un mensaje que usa una variable sin valor no se muestra: “Envío gratis desde {'{envio_gratis_desde}'}” aparece solo cuando hay un monto en Configuración › Envíos y pagos.</p>
            <ul className="mt-3 space-y-1 text-sm">
              {Object.entries(VARIABLE_HELP).map(([k, v]) => (
                <li key={k}>
                  <code className="rounded bg-shell px-1">{`{${k}}`}</code> {v}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
