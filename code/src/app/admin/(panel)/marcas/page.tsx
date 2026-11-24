import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { resolveImages } from '@/server/media'
import { AdminForm } from '@/components/admin/form'
import { ImageField, TextArea, TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { DataTable, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { createBrandAction } from './actions'

export const metadata = { title: 'Marcas' }

export default async function BrandsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const db = getDb()
  const brands = await db.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } })
  const logos = await resolveImages(db, brands.flatMap((b) => (b.logoFile ? [b.logoFile] : [])))
  return (
    <>
      <PageHeader title="Marcas" description="La descripción es la introducción editorial de la página de la marca." />
      {sp.borrada !== undefined && (
        <div className="mb-4">
          <Notice tone="success">Marca enviada a la papelera.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DataTable
          rows={brands}
          rowKey={(b) => b.id}
          empty="Todavía no hay marcas."
          columns={[
            {
              key: 'logo',
              label: '',
              className: 'w-16',
              render: (b) => {
                const logo = b.logoFile ? logos.get(b.logoFile) : undefined
                // eslint-disable-next-line @next/next/no-img-element
                return logo ? <img src={logo.src} alt="" className="h-8 w-12 object-contain" /> : null
              },
            },
            {
              key: 'name',
              label: 'Marca',
              render: (b) => (
                <div>
                  <Link href={`/marcas/${b.code}`} className="font-medium underline-offset-2 hover:underline">
                    {b.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{b.code}</p>
                </div>
              ),
            },
            { key: 'country', label: 'País', render: (b) => b.countryOfOrigin ?? '—' },
            { key: 'products', label: 'Productos', className: 'text-right tabular-nums', render: (b) => <Link href={`/productos?marca=${b.code}`}>{b._count.products}</Link> },
          ]}
        />
        {can(admin.role, 'catalog.edit') && (
          <Card title="Nueva marca">
            <AdminForm action={createBrandAction} submitLabel="Crear marca">
              <KeepInput />
              <TextField name="code" label="Código" required help="Minúsculas, números y guiones. No se cambia después." />
              <TextField name="name" label="Nombre" required />
              <TextField name="countryOfOrigin" label="País de origen" />
              <TextArea name="description" label="Descripción" />
              <ImageField name="logoFile" label="Logo" />
            </AdminForm>
          </Card>
        )}
      </div>
    </>
  )
}
