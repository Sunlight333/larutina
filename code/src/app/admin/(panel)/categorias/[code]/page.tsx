import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { categorySubtree } from '@/server/services/admin/catalog/taxonomies'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { Select, TextArea, TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { AdminLink, Card, PageHeader } from '@/components/admin/ui'
import { deleteCategoryAction, updateCategoryAction } from '../actions'
import { flattenTree } from '../tree'

export const metadata = { title: 'Categoría' }

export default async function CategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const admin = await requireAdmin('catalog.view')
  const { code } = await params
  const db = getDb()
  const category = await db.category.findFirst({ where: { code, deletedAt: null }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } })
  if (!category) notFound()
  const [all, subtree] = await Promise.all([db.category.findMany({ where: { deletedAt: null } }), categorySubtree(db, category.id)])
  // A category cannot hang from itself or from one of its subcategories.
  const parentOptions = flattenTree(all)
    .filter((c) => !subtree.has(c.id))
    .map((c) => ({ value: c.id, label: `${'— '.repeat(c.depth)}${c.name}` }))
  return (
    <>
      <PageHeader title={category.name} description={`Código ${category.code}`} back={{ href: '/categorias', label: 'Categorías' }} actions={<AdminLink href={`/productos?categoria=${category.code}`}>Ver sus {category._count.products} productos</AdminLink>} />
      <fieldset disabled={!can(admin.role, 'catalog.edit')} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={updateCategoryAction.bind(null, category.code)}>
            <KeepInput />
            <TextField name="name" label="Nombre" defaultValue={category.name} required />
            <Select name="parentId" label="Categoría padre" options={parentOptions} defaultValue={category.parentId} allowEmpty="Ninguna (primer nivel)" />
            <TextField name="sortOrder" label="Orden" defaultValue={category.sortOrder} help="1 = primera." />
            <TextArea name="description" label="Descripción" defaultValue={category.description} rows={5} help="Introducción de la página de la categoría." />
          </AdminForm>
        </Card>
        <Card title="Borrar">
          <AdminForm action={deleteCategoryAction.bind(null, category.code)} submitLabel={null}>
            <p className="text-sm text-ink-muted">Va a la papelera. No se puede mientras tenga productos o subcategorías.</p>
            <SubmitButton variant="danger" confirm="¿Enviar la categoría a la papelera?">
              Borrar categoría
            </SubmitButton>
          </AdminForm>
        </Card>
      </fieldset>
    </>
  )
}
