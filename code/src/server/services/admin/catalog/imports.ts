// The import screen's side of CAT-02: size and format checks, the audit entry
// (the ImportJob does not know who ran it) and the validated file kept in
// private storage, so "Importar este archivo" applies exactly what was
// validated without uploading it again. The import itself re-validates.
import type { ImportJob } from '@prisma/client'
import { audit } from '@/server/audit'
import { importCatalog, type ImportReport } from '@/server/catalog-import'
import type { Issue, Stage } from '@/server/catalog-import/validate'
import type { Counts } from '@/server/catalog-import/apply'
import { storage } from '@/server/storage'
import type { Actor, Db } from './common'

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const storedKey = (jobId: string) => `private/imports/${jobId}.xlsx`

export type ImportFile = { name: string; data: Uint8Array }

export function importFileProblem(file: ImportFile | undefined): string | null {
  if (!file) return 'Elegí el archivo de la planilla.'
  if (/\.csv$/i.test(file.name)) return 'La importación usa la planilla completa en .xlsx (todas las hojas juntas). Para precios y stock en .csv usá "Actualizar en lote".'
  if (!/\.xlsx$/i.test(file.name)) return 'Usá la plantilla v1.1 en formato .xlsx.'
  if (file.data.byteLength > MAX_IMPORT_BYTES) return 'El archivo pesa más de 25 MB.'
  return null
}

export async function runImport(db: Db, actor: Actor, file: ImportFile, opts: { stage: Stage; dryRun: boolean; canCost: boolean }): Promise<ImportReport> {
  let report: ImportReport
  try {
    report = await importCatalog(db, file, { stage: opts.stage, dryRun: opts.dryRun, ignoreCost: !opts.canCost })
  } catch (e) {
    // An unreadable file still leaves a job with the reason, like any rejected import.
    const message = e instanceof Error && /zip|signature|central directory|end of data/i.test(e.message) ? 'El archivo no es un .xlsx válido o está dañado.' : 'No se pudo leer el archivo.'
    if (!(e instanceof Error)) throw e
    const job = await db.importJob.create({
      data: { fileName: file.name, status: 'REJECTED', stage: opts.stage, summary: { counts: {}, missing: [] }, issues: [{ level: 'error', sheet: '—', message }] },
    })
    report = { jobId: job.id, status: 'REJECTED', stage: opts.stage, errors: 1, warnings: 0, issues: [{ level: 'error', sheet: '—', message }], missing: [], counts: {} }
  }
  if (report.status === 'VALIDATED') await storage().put(storedKey(report.jobId), Buffer.from(file.data), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  await audit(db, actor, {
    action: report.status === 'APPLIED' ? 'import' : 'import.validate',
    entityType: 'ImportJob',
    entityId: report.jobId,
    label: file.name,
    after: { status: report.status, stage: report.stage, errors: report.errors, warnings: report.warnings, counts: report.counts },
  })
  return report
}

/** Applies a file validated earlier (status VALIDATED), after validating it again against today's catalog. */
export async function applyValidated(db: Db, actor: Actor, jobId: string, canCost: boolean): Promise<ImportReport | { error: string }> {
  const job = await db.importJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'VALIDATED') return { error: 'Esa validación no se puede aplicar.' }
  const data = await storage().get(storedKey(jobId))
  if (!data) return { error: 'El archivo ya no está guardado: subilo de nuevo.' }
  const report = await runImport(db, actor, { name: job.fileName, data: new Uint8Array(data) }, { stage: job.stage as Stage, dryRun: false, canCost })
  if (report.status === 'APPLIED') await storage().delete(storedKey(jobId))
  return report
}

export async function hasStoredFile(jobId: string) {
  return (await storage().get(storedKey(jobId))) !== null
}

export type JobView = {
  job: ImportJob
  counts: Counts
  missing: { sheet: string; field: string; rows: number }[]
  issues: Issue[]
}

export function jobView(job: ImportJob): JobView {
  const summary = (job.summary ?? {}) as { counts?: Counts; missing?: JobView['missing'] }
  return { job, counts: summary.counts ?? {}, missing: summary.missing ?? [], issues: (job.issues ?? []) as unknown as Issue[] }
}
