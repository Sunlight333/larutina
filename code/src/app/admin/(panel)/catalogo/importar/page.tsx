import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { MAX_IMPORT_BYTES } from '@/server/services/admin/catalog/imports'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Select } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { importAction } from './actions'
import { ImportStatusBadge, STAGE_LABELS } from './status'

export const metadata = { title: 'Importar planilla' }

export default async function ImportPage() {
  await requireAdmin('catalog.import')
  const jobs = await getDb().importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 30 })
  const count = (issues: unknown, level: string) => (Array.isArray(issues) ? issues.filter((i: { level?: string }) => i.level === level).length : 0)
  return (
    <>
      <PageHeader
        title="Importar planilla"
        description="La planilla maestra en la plantilla v1.1. Primero se valida todo; si hay un error, no se importa nada. Los productos nuevos quedan en Borrador."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title="Subir planilla">
          <AdminForm
            action={importAction}
            submitLabel={null}
            extraButtons={
              <>
                <SubmitButton name="mode" value="validar">
                  Validar
                </SubmitButton>
                <SubmitButton name="mode" value="importar" variant="secondary" confirm="Se valida de nuevo y, si no hay errores, se importa todo junto. ¿Seguir?">
                  Importar
                </SubmitButton>
              </>
            }
          >
            <div className="space-y-1.5">
              <label htmlFor="import-file" className="block text-sm font-medium">
                Archivo .xlsx <span className="text-ink-muted">(obligatorio)</span>
              </label>
              <input id="import-file" name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="import-file-help" className="block text-sm" />
              <p id="import-file-help" className="text-xs text-ink-muted">
                Hasta {MAX_IMPORT_BYTES / 1024 / 1024} MB. El formato es la planilla completa en .xlsx, con todas sus hojas: un .csv no alcanza, porque cada producto se arma con varias hojas. Para cambiar solo precios, stock o estado con un .csv, usá{' '}
                <Link href="/admin/catalogo/lote" className="underline">
                  Actualizar en lote
                </Link>
                .
              </p>
            </div>
            <Select
              name="stage"
              label="Etapa"
              options={Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))}
              defaultValue="S1"
              help="Muestra: lo del catálogo completo que falte se informa sin frenar. Catálogo completo: todo lo obligatorio tiene que estar."
            />
            <p className="text-sm text-ink-muted">“Validar” revisa el archivo sin cambiar nada y muestra el reporte; desde el reporte se puede importar ese mismo archivo.</p>
          </AdminForm>
        </Card>
        <Card title="Plantilla">
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/admin/catalogo/exportar" className="underline">
                Descargar el catálogo actual
              </a>{' '}
              <span className="text-ink-muted">para editarlo y volver a importarlo.</span>
            </li>
            <li>
              <a href="/admin/catalogo/exportar?vacia=1" className="underline">
                Descargar la plantilla vacía
              </a>
            </li>
          </ul>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-base font-semibold">Historial</h2>
      <DataTable
        rows={jobs}
        rowKey={(j) => j.id}
        empty="Todavía no se importó ninguna planilla."
        columns={[
          {
            key: 'date',
            label: 'Fecha',
            render: (j) => (
              <Link href={`/admin/catalogo/importar/${j.id}`} className="underline-offset-2 hover:underline">
                {formatDateTime(j.createdAt)}
              </Link>
            ),
          },
          { key: 'file', label: 'Archivo', render: (j) => <span className="break-all">{j.fileName}</span> },
          { key: 'stage', label: 'Etapa', render: (j) => STAGE_LABELS[j.stage] ?? j.stage },
          { key: 'status', label: 'Resultado', render: (j) => <ImportStatusBadge status={j.status} /> },
          { key: 'errors', label: 'Errores', className: 'text-right tabular-nums', render: (j) => count(j.issues, 'error') },
          { key: 'warnings', label: 'Avisos', className: 'text-right tabular-nums', render: (j) => count(j.issues, 'warning') },
        ]}
      />
    </>
  )
}
