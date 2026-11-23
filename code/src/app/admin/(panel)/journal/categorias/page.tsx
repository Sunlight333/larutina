import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { Card, EmptyState, PageHeader } from '@/components/admin/ui'
import { createCategoryAction, updateCategoryAction } from '../actions'

export const metadata = { title: 'Categorías del journal' }

export default async function JournalCategories() {
  await requireAdmin('content.edit')
  const categories = await getDb().articleCategory.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] })
  return (
    <>
      <PageHeader title="Categorías del journal" description="Se muestran como filtro en /journal, en este orden." back={{ href: '/admin/journal', label: 'Journal' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          {categories.length === 0 && <EmptyState>Todavía no hay categorías.</EmptyState>}
          {categories.map((c) => (
            <Card key={c.id}>
              <AdminForm
                action={updateCategoryAction.bind(null, c.id)}
                className="grid items-end gap-3 sm:grid-cols-[1fr_6rem_auto]"
                submitLabel="Guardar"
                extraButtons={
                  <SubmitButton name="intent" value="delete" variant="ghost" confirm={`¿Borrar la categoría "${c.name}"?`}>
                    Borrar
                  </SubmitButton>
                }
              >
                <TextField name="name" label={`Nombre · /journal?categoria=${c.slug}`} defaultValue={c.name} required />
                <TextField name="position" label="Orden" type="number" defaultValue={c.position} />
              </AdminForm>
            </Card>
          ))}
        </div>
        <Card title="Nueva categoría">
          <AdminForm action={createCategoryAction} submitLabel="Crear" resetOnSuccess>
            <TextField name="name" label="Nombre" required />
            <TextField name="slug" label="Dirección" help="Opcional: sale del nombre." />
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
