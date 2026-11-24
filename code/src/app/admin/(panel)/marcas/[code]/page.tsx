import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { resolveImages } from '@/server/media'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { ImageField, TextArea, TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { AdminLink, Card, PageHeader } from '@/components/admin/ui'
import { deleteBrandAction, updateBrandAction } from '../actions'

export const metadata = { title: 'Marca' }

export default async function BrandPage({ params }: { params: Promise<{ code: string }> }) {
  const admin = await requireAdmin('catalog.view')
  const { code } = await params
  const db = getDb()
  const brand = await db.brand.findFirst({ where: { code, deletedAt: null }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } })
  if (!brand) notFound()
  const logo = brand.logoFile ? (await resolveImages(db, [brand.logoFile])).get(brand.logoFile) : undefined
  const canEdit = can(admin.role, 'catalog.edit')
  return (
    <>
      <PageHeader title={brand.name} description={`Código ${brand.code}`} back={{ href: '/marcas', label: 'Marcas' }} actions={<AdminLink href={`/productos?marca=${brand.code}`}>Ver sus {brand._count.products} productos</AdminLink>} />
      <fieldset disabled={!canEdit} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={updateBrandAction.bind(null, brand.code)}>
            <KeepInput />
            <TextField name="name" label="Nombre" defaultValue={brand.name} required />
            <TextField name="countryOfOrigin" label="País de origen" defaultValue={brand.countryOfOrigin} help="Los productos sin país propio usan este." />
            <TextArea name="description" label="Descripción" defaultValue={brand.description} rows={6} help="Introducción editorial de la página de la marca." />
            <ImageField name="logoFile" label="Logo" defaultKey={brand.logoFile} previewUrl={logo?.src} />
          </AdminForm>
        </Card>
        <Card title="Borrar">
          <AdminForm action={deleteBrandAction.bind(null, brand.code)} submitLabel={null}>
            <p className="text-sm text-ink-muted">Va a la papelera. No se puede mientras haya productos de la marca.</p>
            <SubmitButton variant="danger" confirm="¿Enviar la marca a la papelera?">
              Borrar marca
            </SubmitButton>
          </AdminForm>
        </Card>
      </fieldset>
    </>
  )
}
