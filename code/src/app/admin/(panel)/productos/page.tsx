import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { resolveImages } from '@/server/media'
import { formatPesos } from '@/server/services/admin/catalog/common'
import { listProducts, STATUS_OPTIONS, statusLabel, TYPE_OPTIONS } from '@/server/services/admin/catalog/products'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Select } from '@/components/admin/fields'
import { SelectAll } from '@/components/admin/select-all'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { AdminLink, Badge, Notice, PageHeader } from '@/components/admin/ui'
import { bulkStatusAction } from './actions'
import { CompletenessBadge, StatusBadge } from './badges'

export const metadata = { title: 'Productos' }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const db = getDb()
  const page = pageOf(sp)
  const filters = { q: param(sp, 'q'), status: param(sp, 'estado'), brand: param(sp, 'marca'), category: param(sp, 'categoria'), type: param(sp, 'tipo') }
  const [{ total, rows }, brands, categories] = await Promise.all([
    listProducts(db, filters, page),
    db.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { code: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { code: true, name: true } }),
  ])
  const images = await resolveImages(db, rows.flatMap((r) => (r.image ? [r.image] : [])))
  const canEdit = can(admin.role, 'catalog.edit')

  return (
    <>
      <PageHeader
        title="Productos"
        description="Los productos nuevos quedan en Borrador. Lo publicado se edita en borrador y se publica con vista previa."
        actions={canEdit && <AdminLink href="/productos/nuevo" variant="primary">Nuevo producto</AdminLink>}
      />
      {sp.borrado !== undefined && (
        <div className="mb-4">
          <Notice tone="success">Producto enviado a la papelera. Se puede restaurar desde Papelera.</Notice>
        </div>
      )}
      <FilterBar
        sp={sp}
        placeholder="Buscar por nombre, código o SKU"
        selects={[
          { name: 'estado', label: 'Estado', options: STATUS_OPTIONS },
          { name: 'marca', label: 'Marca', options: brands.map((b) => ({ value: b.code, label: b.name })) },
          { name: 'categoria', label: 'Categoría', options: categories.map((c) => ({ value: c.code, label: c.name })) },
          { name: 'tipo', label: 'Tipo', options: TYPE_OPTIONS },
        ]}
      />
      <AdminForm action={bulkStatusAction} submitLabel={null} className="space-y-3">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="No hay productos con esos filtros."
          columns={[
            ...(canEdit
              ? [
                  {
                    key: 'sel',
                    label: '',
                    className: 'w-8',
                    render: (r: (typeof rows)[number]) => <input type="checkbox" name="ids" value={r.id} aria-label={`Seleccionar ${r.name}`} className="size-4 accent-ink" />,
                  },
                ]
              : []),
            {
              key: 'img',
              label: '',
              className: 'w-14',
              render: (r) => {
                const img = r.image ? images.get(r.image) : undefined
                return img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.src} alt="" className="h-12 w-10 rounded border border-line object-cover" loading="lazy" />
                ) : (
                  <span className="block h-12 w-10 rounded border border-dashed border-line-strong" aria-label="Sin imagen" />
                )
              },
            },
            {
              key: 'name',
              label: 'Producto',
              render: (r) => (
                <div>
                  <Link href={`/productos/${r.code}`} className="font-medium underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {r.code}
                    {r.type !== 'PRODUCT' && ` · ${TYPE_OPTIONS.find((t) => t.value === r.type)?.label}`}
                  </p>
                </div>
              ),
            },
            { key: 'brand', label: 'Marca', render: (r) => r.brand },
            {
              key: 'status',
              label: 'Estado',
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={r.status} />
                  {r.hasDraft && <Badge tone="warning">Cambios sin publicar</Badge>}
                </div>
              ),
            },
            {
              key: 'price',
              label: 'Precio',
              className: 'text-right tabular-nums',
              render: (r) =>
                r.mainPromoCents ? (
                  <span>
                    {formatPesos(r.mainPromoCents)} <s className="text-xs text-ink-muted">{formatPesos(r.mainPriceCents)}</s>
                  </span>
                ) : (
                  formatPesos(r.mainPriceCents)
                ),
            },
            { key: 'stock', label: 'Stock', className: 'text-right tabular-nums', render: (r) => (r.stock === 0 ? <Badge tone="danger">0</Badge> : r.stock) },
            { key: 'complete', label: 'Completo', render: (r) => <CompletenessBadge completeness={r.completeness} /> },
          ]}
        />
        {canEdit && rows.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-3">
            <label className="flex items-center gap-2 self-center text-sm">
              <SelectAll name="ids" /> Todos los de esta página
            </label>
            <div className="w-48">
              <Select name="status" label="Pasar los seleccionados a" options={STATUS_OPTIONS} defaultValue="ACTIVE" />
            </div>
            <SubmitButton variant="secondary" confirm="¿Cambiar el estado de los productos seleccionados?">
              Cambiar estado
            </SubmitButton>
            <p className="text-xs text-ink-muted">Para publicar, cada producto necesita los datos obligatorios, una imagen y una variante principal.</p>
          </div>
        )}
      </AdminForm>
      <Pagination basePath="/productos" sp={sp} total={total} page={page.page} size={page.size} />
      <p className="mt-2 text-xs text-ink-muted">Estados: {STATUS_OPTIONS.map((o) => statusLabel(o.value)).join(' · ')}.</p>
    </>
  )
}
