import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { STATUS_OPTIONS, TYPE_OPTIONS } from '@/server/services/admin/catalog/products'
import { Select, TextField } from '@/components/admin/fields'
import { Card, PageHeader } from '@/components/admin/ui'
import { applyBulkAction, previewPanelAction, previewSheetAction } from './actions'
import { BulkTool } from './bulk-tool'

export const metadata = { title: 'Exportar y actualizar en lote' }

const link = 'inline-flex h-9 items-center rounded-lg border border-line-strong bg-paper px-3.5 text-sm font-medium hover:border-ink'

export default async function BulkPage() {
  const admin = await requireAdmin('catalog.import')
  const db = getDb()
  const [brands, categories] = await Promise.all([
    db.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { code: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { code: true, name: true } }),
  ])
  const all = (label: string) => `${label}: todos`
  return (
    <>
      <PageHeader title="Exportar y actualizar en lote" description="Precio, precio promocional, stock y estado de muchos productos a la vez, siempre con vista previa." />
      <div className="space-y-6">
        <Card title="Exportar">
          <div className="flex flex-wrap gap-2">
            {/* Plain links: these are file downloads from route handlers, not pages. */}
            <a href="/catalogo/exportar" className={link}>
              Catálogo completo (plantilla v1.1)
            </a>
            <a href="/catalogo/exportar?formato=lote" className={link}>
              Planilla de precios y stock
            </a>
            <a href="/catalogo/exportar?vacia=1" className={link}>
              Plantilla v1.1 vacía
            </a>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            El catálogo completo se puede editar y volver a importar desde Importar planilla: sin cambios, importarlo no modifica nada.
            {can(admin.role, 'catalog.cost') ? ' Incluye el costo de cada variante.' : ' Sin la columna de costo (solo la ve Administración); al importarlo, los costos no cambian.'}
          </p>
        </Card>

        <Card
          title="Desde una planilla"
          description={
            <>
              Una fila por SKU con las columnas <code>sku</code> y cualquiera de <code>precio_ars</code>, <code>precio_promocional_ars</code>, <code>stock</code> y <code>estado</code>, en .xlsx o .csv. Celda vacía: no cambia. Precios en pesos sin puntos (18900);{' '}
              <code>0</code> en el precio promocional quita la promoción. El estado es del producto: Borrador, Activo, Preventa, Agotado o Archivado.
            </>
          }
        >
          <BulkTool previewAction={previewSheetAction} applyAction={applyBulkAction} encType="multipart/form-data">
            <div className="space-y-1.5">
              <label htmlFor="bulk-file" className="block text-sm font-medium">
                Planilla
              </label>
              <input id="bulk-file" name="file" type="file" required accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="block text-sm" />
            </div>
          </BulkTool>
        </Card>

        <Card title="Desde el panel" description="Elegí qué productos y qué cambio. El porcentaje se aplica al precio y al precio promocional, redondeado a pesos enteros.">
          <BulkTool previewAction={previewPanelAction} applyAction={applyBulkAction}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Select name="marca" label="Marca" options={brands.map((b) => ({ value: b.code, label: b.name }))} allowEmpty={all('Marca')} />
              <Select name="categoria" label="Categoría" options={categories.map((c) => ({ value: c.code, label: c.name }))} allowEmpty={all('Categoría')} />
              <Select name="estado" label="Estado actual" options={STATUS_OPTIONS} allowEmpty={all('Estado')} />
              <Select name="tipo" label="Tipo" options={TYPE_OPTIONS} allowEmpty={all('Tipo')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                name="mode"
                label="Cambio"
                options={[
                  { value: 'percent', label: 'Precio en un porcentaje' },
                  { value: 'status', label: 'Pasar a un estado' },
                ]}
                defaultValue="percent"
              />
              <TextField name="percent" label="Porcentaje" placeholder="10 o -5" help="Para un cambio de precio. Negativo baja el precio." />
              <Select name="newStatus" label="Estado nuevo" options={STATUS_OPTIONS} defaultValue="ACTIVE" help="Para un cambio de estado." />
            </div>
          </BulkTool>
        </Card>
      </div>
    </>
  )
}
