import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { hasStoredFile, jobView } from '@/server/services/admin/catalog/imports'
import type { Issue } from '@/server/catalog-import/validate'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Card, DefinitionList, EmptyState, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'
import { applyValidatedAction } from '../actions'
import { ImportStatusBadge, STAGE_LABELS } from '../status'

export const metadata = { title: 'Reporte de importación' }

const LEVELS: { level: Issue['level']; title: string; tone: string }[] = [
  { level: 'error', title: 'Errores', tone: 'text-[oklch(0.5_0.17_25)]' },
  { level: 'warning', title: 'Avisos', tone: 'text-accent-ink' },
  { level: 'info', title: 'Notas', tone: 'text-ink-muted' },
]
const SHOWN = 300

export default async function ImportReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('catalog.import')
  const { id } = await params
  const db = getDb()
  const job = await db.importJob.findUnique({ where: { id } })
  if (!job) notFound()
  const { counts, missing, issues } = jobView(job)
  const [entry, stored] = await Promise.all([
    db.auditLog.findFirst({ where: { entityType: 'ImportJob', entityId: job.id }, select: { actorEmail: true } }),
    job.status === 'VALIDATED' ? hasStoredFile(job.id) : Promise.resolve(false),
  ])
  const by = (level: Issue['level']) => issues.filter((i) => i.level === level)
  const sheets = (list: Issue[]) => [...new Set(list.map((i) => i.sheet))]

  return (
    <>
      <PageHeader title={job.fileName} description={<ImportStatusBadge status={job.status} />} back={{ href: '/admin/catalogo/importar', label: 'Importar planilla' }} />
      <div className="space-y-6">
        {job.status === 'REJECTED' && (
          <Notice tone="danger" title="No se importó nada">
            Corregí los errores en la planilla y volvé a subirla. Cada error indica hoja, fila y columna.
          </Notice>
        )}
        {job.status === 'VALIDATED' && (
          <Notice tone="info" title="Validada sin errores: todavía no se importó">
            {stored ? 'Revisá los avisos y, si está todo bien, importala.' : 'El archivo ya no está guardado: subilo de nuevo para importarlo.'}
          </Notice>
        )}
        {job.status === 'APPLIED' && <Notice tone="success" title="Importada">Los productos nuevos quedaron en Borrador; los que ya existían conservan su estado.</Notice>}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card title="Resumen">
            <DefinitionList
              items={[
                ['Fecha', formatDateTime(job.createdAt)],
                ['Por', entry?.actorEmail ?? '—'],
                ['Etapa', STAGE_LABELS[job.stage] ?? job.stage],
                ['Errores', by('error').length],
                ['Avisos', by('warning').length],
              ]}
            />
            {Object.keys(counts).length > 0 && (
              <table className="mt-4 w-full text-left text-sm">
                <caption className="sr-only">Registros por hoja</caption>
                <thead className="text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-1.5 font-medium">Hoja</th>
                    {job.status === 'APPLIED' ? (
                      <>
                        <th scope="col" className="py-1.5 text-right font-medium">Nuevos</th>
                        <th scope="col" className="py-1.5 text-right font-medium">Actualizados</th>
                      </>
                    ) : (
                      <th scope="col" className="py-1.5 text-right font-medium">Filas</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(counts).map(([sheet, c]) => (
                    <tr key={sheet}>
                      <td className="py-1.5">{sheet}</td>
                      {job.status === 'APPLIED' ? (
                        <>
                          <td className="py-1.5 text-right tabular-nums">{c.created}</td>
                          <td className="py-1.5 text-right tabular-nums">{c.updated}</td>
                        </>
                      ) : (
                        <td className="py-1.5 text-right tabular-nums">{c.inFile ?? c.created + c.updated}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <div className="space-y-6">
            {job.status === 'VALIDATED' && stored && (
              <Card title="Importar">
                <AdminForm action={applyValidatedAction.bind(null, job.id)} submitLabel={null}>
                  <p className="text-sm text-ink-muted">Se valida de nuevo contra el catálogo de hoy y se importa todo junto.</p>
                  <SubmitButton confirm="¿Importar este archivo?">Importar este archivo</SubmitButton>
                </AdminForm>
              </Card>
            )}
            <Card title="Falta para el catálogo completo" description="Columnas obligatorias en la etapa S5 que siguen vacías.">
              {missing.length ? (
                <ul className="space-y-1 text-sm">
                  {missing.map((m) => (
                    <li key={`${m.sheet}-${m.field}`}>
                      {m.sheet} › <code className="text-xs">{m.field}</code>: <span className="tabular-nums">{m.rows}</span> {m.rows === 1 ? 'fila' : 'filas'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">Nada pendiente.</p>
              )}
            </Card>
          </div>
        </div>

        {LEVELS.map(({ level, title, tone }) => {
          const list = by(level)
          if (!list.length) return null
          return (
            <Card key={level} title={`${title} (${list.length})`}>
              <div className="space-y-2">
                {sheets(list).map((sheet) => {
                  const rows = list.filter((i) => i.sheet === sheet)
                  return (
                    <details key={sheet} open={level === 'error' || rows.length <= 10} className="rounded-lg border border-line">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                        {sheet} <span className="text-ink-muted">· {rows.length}</span>
                      </summary>
                      <table className="w-full text-left text-sm">
                        <thead className="bg-shell/60 text-xs uppercase tracking-wide text-ink-muted">
                          <tr>
                            <th scope="col" className="w-16 px-3 py-1.5 font-medium">Fila</th>
                            <th scope="col" className="w-48 px-3 py-1.5 font-medium">Columna</th>
                            <th scope="col" className="px-3 py-1.5 font-medium">Motivo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {rows.slice(0, SHOWN).map((i, n) => (
                            <tr key={n}>
                              <td className="px-3 py-1.5 tabular-nums">{i.row ?? '—'}</td>
                              <td className="px-3 py-1.5 font-mono text-xs">{i.field ?? '—'}</td>
                              <td className={`px-3 py-1.5 ${tone}`}>{i.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rows.length > SHOWN && <p className="px-3 py-2 text-xs text-ink-muted">Y {rows.length - SHOWN} más en esta hoja.</p>}
                    </details>
                  )
                })}
              </div>
            </Card>
          )
        })}
        {!issues.length && <EmptyState>Sin observaciones.</EmptyState>}
      </div>
    </>
  )
}
