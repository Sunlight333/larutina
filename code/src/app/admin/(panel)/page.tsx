import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { getSettings } from '@/server/settings'
import { Card, Notice, PageHeader, Stat, formatDateTime } from '@/components/admin/ui'
import { param, type SearchParams } from '@/components/admin/table'

export const metadata = { title: 'Inicio' }

export default async function PanelHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const db = getDb()
  const s = await getSettings()
  const [byStatus, lastImport, waitlist, newsletter, messages] = await Promise.all([
    db.product.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    db.importJob.findFirst({ orderBy: { createdAt: 'desc' } }),
    db.waitlistSignup.count(),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.contactMessage.count({ where: { status: 'NEW' } }),
  ])
  const count = (st: string) => byStatus.find((b) => b.status === st)?._count ?? 0
  const pending = [
    !s['company.legalName'] && 'Razón social, CUIT y domicilio (footer y legales)',
    !s['brand.senderEmail'] && 'Email remitente',
    s['commerce.freeShippingFromCents'] === 0 && 'Monto de envío gratis',
  ].filter(Boolean) as string[]

  return (
    <>
      <PageHeader title={`Hola, ${admin.name.split(' ')[0]}`} />
      <div className="space-y-6">
        {sp['sin-permiso'] !== undefined && <Notice tone="warning">Tu rol no tiene acceso a esa sección.</Notice>}
        {(s['site.waitlistMode'] || s['site.maintenanceMode']) && (
          <Notice tone="info" title={s['site.maintenanceMode'] ? 'El sitio está en mantenimiento' : 'La ventana Próximamente está activa'}>
            {s['site.maintenanceMode'] ? 'Las visitas ven la página de mantenimiento; vos ves el sitio completo mientras tengas la sesión abierta.' : 'Las visitas ven la lista de espera en una ventana que pueden cerrar para recorrer el sitio.'}
          </Notice>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Productos activos" value={count('ACTIVE') + count('PRESALE')} href={can(admin.role, 'catalog.view') ? '/admin/productos?estado=ACTIVE' : undefined} />
          <Stat label="En borrador" value={count('DRAFT')} href={can(admin.role, 'catalog.view') ? '/admin/productos?estado=DRAFT' : undefined} />
          <Stat label="Lista de espera" value={waitlist} href={can(admin.role, 'subscribers.export') ? '/admin/suscriptores' : undefined} />
          <Stat label="Mensajes nuevos" value={messages} href={can(admin.role, 'messages.view') ? '/admin/mensajes' : undefined} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {can(admin.role, 'catalog.import') && (
            <Card title="Última importación">
              {lastImport ? (
                <p className="text-sm">
                  {lastImport.fileName} · {formatDateTime(lastImport.createdAt)} ·{' '}
                  {lastImport.status === 'APPLIED' ? 'aplicada' : lastImport.status === 'VALIDATED' ? 'validada sin aplicar' : 'rechazada'}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">Todavía no se importó ninguna planilla.</p>
              )}
            </Card>
          )}
          {admin.role === 'ADMIN' && pending.length > 0 && (
            <Card title="Datos pendientes antes del lanzamiento" description="Se cargan en Configuración.">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {pending.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Newsletter">
            <p className="text-sm">{newsletter} suscripciones activas.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
