import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm } from '@/components/admin/form'
import { Select, TextArea, TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { DataTable, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { createCategoryAction } from './actions'
import { flattenTree } from './tree'

export const metadata = { title: 'Categorías' }

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const rows = flattenTree(
    await getDb().category.findMany({ where: { deletedAt: null }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } }),
  )
  const parentOptions = rows.map((c) => ({ value: c.id, label: `${'— '.repeat(c.depth)}${c.name}` }))
  return (
    <>
      <PageHeader title="Categorías" description="Árbol de navegación. Cada producto va en la categoría más específica." />
      {sp.borrada !== undefined && (
        <div className="mb-4">
          <Notice tone="success">Categoría enviada a la papelera.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DataTable
          rows={rows}
          rowKey={(c) => c.id}
          empty="Todavía no hay categorías."
          columns={[
            {
              key: 'name',
              label: 'Categoría',
              render: (c) => (
                <div style={{ paddingLeft: `${c.depth * 1.25}rem` }}>
                  <Link href={`/admin/categorias/${c.code}`} className="font-medium underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{c.code}</p>
                </div>
              ),
            },
            { key: 'order', label: 'Orden', className: 'tabular-nums', render: (c) => c.sortOrder ?? '—' },
            { key: 'products', label: 'Productos', className: 'text-right tabular-nums', render: (c) => <Link href={`/admin/productos?categoria=${c.code}`}>{c._count.products}</Link> },
          ]}
        />
        {can(admin.role, 'catalog.edit') && (
          <Card title="Nueva categoría">
            <AdminForm action={createCategoryAction} submitLabel="Crear categoría">
              <KeepInput />
              <TextField name="code" label="Código" required help="Minúsculas, números y guiones. No se cambia después." />
              <TextField name="name" label="Nombre" required />
              <Select name="parentId" label="Categoría padre" options={parentOptions} allowEmpty="Ninguna (primer nivel)" />
              <TextField name="sortOrder" label="Orden" help="1 = primera." />
              <TextArea name="description" label="Descripción" />
            </AdminForm>
          </Card>
        )}
      </div>
    </>
  )
}
