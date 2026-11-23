import type { ProductStatus } from '@prisma/client'
import type { Completeness } from '@/server/services/admin/catalog/completeness'
import { DATA_FIELDS, type DataValues } from '@/server/services/admin/catalog/product-fields'
import { STATUS_OPTIONS } from '@/server/services/admin/catalog/products'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Select } from '@/components/admin/fields'
import { Card, formatDate } from '@/components/admin/ui'
import { deleteProductAction, publishAction, statusAction } from '../actions'
import { CompletenessBadge } from '../badges'

const labelOf = (name: string) => DATA_FIELDS.find((f) => f.name === name)?.label ?? name
const show = (v: DataValues[string]) => (v === null || v === undefined || v === '' ? '(vacío)' : Array.isArray(v) ? v.join(' · ') || '(vacío)' : String(v))

/** ADM-02: pending edits of a published product, with preview, publish and discard. */
export function DraftCard({ code, draft, columns }: { code: string; draft: DataValues; columns: DataValues }) {
  const keys = Object.keys(draft)
  return (
    <Card title="Cambios sin publicar" description="El sitio muestra lo publicado; la vista previa muestra estos cambios.">
      <ul className="mb-4 space-y-2 text-sm">
        {keys.map((k) => (
          <li key={k}>
            <span className="font-medium">{labelOf(k)}</span>
            {k !== 'brandId' && k !== 'categoryId' && k !== 'baseProductId' && (
              <span className="block break-words text-xs text-ink-muted">
                <s>{show(columns[k] ?? null).slice(0, 80)}</s> → {show(draft[k] ?? null).slice(0, 80)}
              </span>
            )}
          </li>
        ))}
      </ul>
      <AdminForm action={publishAction.bind(null, code)} submitLabel={null} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <a href={`/producto/${code}?vista-previa=1`} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-sm font-medium hover:border-ink">
            Ver vista previa ↗
          </a>
          <SubmitButton name="op" value="publicar-cambios" confirm="¿Publicar estos cambios en el sitio?">
            Publicar cambios
          </SubmitButton>
          <SubmitButton name="op" value="descartar" variant="ghost" confirm="¿Descartar los cambios sin publicar?">
            Descartar cambios
          </SubmitButton>
        </div>
      </AdminForm>
    </Card>
  )
}

export function StatusCard({ code, status, publishedAt, problems, hasPresaleDate }: { code: string; status: ProductStatus; publishedAt: Date | null; problems: string[]; hasPresaleDate: boolean }) {
  return (
    <Card title="Estado" description={publishedAt ? `Publicado por primera vez el ${formatDate(publishedAt)}.` : 'Todavía no se publicó.'}>
      <div className="space-y-4">
        {status === 'DRAFT' && (
          <AdminForm action={publishAction.bind(null, code)} submitLabel={null} className="space-y-2">
            {problems.length > 0 ? (
              <div className="text-sm">
                <p className="font-medium">Para publicarlo falta:</p>
                <ul className="mt-1 list-disc pl-5 text-ink-muted">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{hasPresaleDate ? 'Tiene fecha de llegada: se publica en Preventa.' : 'Se publica como Activo.'}</p>
            )}
            <SubmitButton name="op" value="publicar" confirm="¿Publicar el producto en el sitio?">
              Publicar
            </SubmitButton>
          </AdminForm>
        )}
        <AdminForm action={statusAction.bind(null, code)} submitLabel="Cambiar estado" className="space-y-2">
          <Select name="status" label="Estado" options={STATUS_OPTIONS} defaultValue={status} help="Se aplica al instante: Agotado y Archivado también se ven en el sitio." />
        </AdminForm>
        <AdminForm action={deleteProductAction.bind(null, code)} submitLabel={null}>
          <SubmitButton variant="ghost" confirm="¿Enviar el producto a la papelera? Se puede restaurar.">
            Eliminar producto
          </SubmitButton>
        </AdminForm>
      </div>
    </Card>
  )
}

export function CompletenessCard({ completeness }: { completeness: Completeness }) {
  return (
    <Card title="Completitud" description="Lo que pide el catálogo completo (S5), más una imagen.">
      <CompletenessBadge completeness={completeness} />
      {completeness.missing.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
          {completeness.missing.map((m) => (
            <li key={m.key}>{m.label}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
