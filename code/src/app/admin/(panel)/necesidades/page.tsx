import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { DataTable, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { createConcernAction } from './actions'
import { ConcernFields } from './fields'

export const metadata = { title: 'Necesidades' }

export default async function ConcernsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const concerns = await getDb().concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, include: { _count: { select: { products: { where: { product: { deletedAt: null } } } } } } })
  return (
    <>
      <PageHeader title="Necesidades" description="Lo que la piel necesita: el diagnóstico, los filtros y las páginas de necesidad." />
      {sp.borrada !== undefined && (
        <div className="mb-4">
          <Notice tone="success">Necesidad enviada a la papelera.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DataTable
          rows={concerns}
          rowKey={(c) => c.id}
          empty="Todavía no hay necesidades."
          columns={[
            {
              key: 'name',
              label: 'Necesidad',
              render: (c) => (
                <div>
                  <Link href={`/necesidades/${c.code}`} className="font-medium underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{c.code}</p>
                </div>
              ),
            },
            { key: 'label', label: 'Etiqueta corta', render: (c) => c.shortLabel },
            { key: 'products', label: 'Productos', className: 'text-right tabular-nums', render: (c) => c._count.products },
          ]}
        />
        {can(admin.role, 'catalog.edit') && (
          <Card title="Nueva necesidad">
            <AdminForm action={createConcernAction} submitLabel="Crear necesidad">
              <KeepInput />
              <TextField name="code" label="Código" required help="Minúsculas, números y guiones. No se cambia después." />
              <ConcernFields />
            </AdminForm>
          </Card>
        )}
      </div>
    </>
  )
}
