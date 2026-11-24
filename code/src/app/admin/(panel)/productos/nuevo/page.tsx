import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { getSettings } from '@/server/settings'
import { LISTS } from '@/server/catalog-import/lists'
import type { DataValues } from '@/server/services/admin/catalog/product-fields'
import { AdminForm } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { MoneyField, Select, TextField } from '@/components/admin/fields'
import { Card, PageHeader } from '@/components/admin/ui'
import { createProductAction } from '../actions'
import { DataFields } from '../data-fields'

export const metadata = { title: 'Nuevo producto' }

const DEFAULTS: DataValues = { type: 'PRODUCT', vegan: 'UNKNOWN', crueltyFree: 'UNKNOWN', dermatologistTested: 'UNKNOWN', moment: 'BOTH' }

export default async function NewProductPage() {
  await requireAdmin('catalog.edit')
  const db = getDb()
  const s = await getSettings()
  const [brands, categories] = await Promise.all([
    db.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, parent: { select: { name: true } } } }),
  ])
  return (
    <>
      <PageHeader
        title="Nuevo producto"
        description="Queda en Borrador: no se ve en el sitio hasta que lo publiques. Ingredientes, necesidades e imágenes se cargan después de crearlo."
        back={{ href: '/productos', label: 'Productos' }}
      />
      <Card>
        <AdminForm action={createProductAction} submitLabel="Crear producto">
          <KeepInput />
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Código</legend>
            <TextField name="code" label="Código del producto" required help="Minúsculas, números y guiones, por ejemplo pur-serum-centella. Es también la dirección de la ficha y no se puede cambiar." />
          </fieldset>
          <DataFields
            values={DEFAULTS}
            brands={brands.map((b) => ({ value: b.id, label: b.name }))}
            categories={categories.map((c) => ({ value: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }))}
            baseProductCode={null}
            dermatologistLabelEnabled={s['catalog.dermatologistLabelEnabled']}
          />
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Primera variante</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="sku" label="SKU" required help="No se puede cambiar después." />
              <TextField name="size" label="Tamaño" required />
              <Select name="unit" label="Unidad" options={LISTS.unidad.labels.map(([label, value]) => ({ value, label }))} defaultValue="ML" />
              <MoneyField name="priceCents" label="Precio" required />
              <TextField name="stock" label="Stock" required defaultValue="0" />
            </div>
          </fieldset>
        </AdminForm>
      </Card>
    </>
  )
}
