import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { Badge, Card, PageHeader } from '@/components/admin/ui'
import { deleteIngredientAction, reviewIngredientAction, updateIngredientAction } from '../actions'
import { IngredientFields } from '../fields'

export const metadata = { title: 'Ingrediente' }

export default async function IngredientPage({ params }: { params: Promise<{ code: string }> }) {
  const admin = await requireAdmin('catalog.view')
  const { code } = await params
  const db = getDb()
  const ingredient = await db.ingredient.findFirst({
    where: { code, deletedAt: null },
    include: { concerns: { select: { concernId: true } }, products: { where: { product: { deletedAt: null } }, include: { product: { select: { code: true, name: true } } }, take: 50 } },
  })
  if (!ingredient) notFound()
  const [families, concerns] = await Promise.all([db.ingredientFamily.findMany({ orderBy: { name: 'asc' } }), db.concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })])
  return (
    <>
      <PageHeader
        title={ingredient.commonName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {ingredient.inciName} · {ingredient.code}
            {ingredient.status === 'REVIEW' ? <Badge tone="warning">Nuevo · revisar</Badge> : <Badge tone="success">Revisado</Badge>}
          </span>
        }
        back={{ href: '/ingredientes', label: 'Ingredientes' }}
      />
      <fieldset disabled={!can(admin.role, 'catalog.edit')} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={updateIngredientAction.bind(null, ingredient.code)}>
            <KeepInput />
            <IngredientFields
              ingredient={ingredient}
              families={families.map((f) => ({ value: f.id, label: f.name }))}
              concerns={concerns.map((c) => ({ value: c.id, label: c.name }))}
              concernIds={ingredient.concerns.map((c) => c.concernId)}
            />
          </AdminForm>
        </Card>
        <div className="space-y-4">
          <Card title="Revisión">
            <AdminForm action={reviewIngredientAction.bind(null, ingredient.code)} submitLabel={null}>
              {ingredient.status === 'REVIEW' ? (
                <>
                  <p className="text-sm text-ink-muted">Llegó desde una lista INCI. Completalo y marcalo como revisado.</p>
                  <SubmitButton name="status" value="ACTIVE">
                    Marcar como revisado
                  </SubmitButton>
                </>
              ) : (
                <SubmitButton name="status" value="REVIEW" variant="ghost">
                  Volver a marcar para revisar
                </SubmitButton>
              )}
            </AdminForm>
          </Card>
          <Card title={`En ${ingredient.products.length} ${ingredient.products.length === 1 ? 'producto' : 'productos'}`}>
            <ul className="space-y-1 text-sm">
              {ingredient.products.map((p) => (
                <li key={p.productId}>
                  <Link href={`/productos/${p.product.code}?s=ingredientes`} className="underline-offset-2 hover:underline">
                    {p.product.name}
                  </Link>
                  {p.isStar && <span className="text-xs text-ink-muted"> · estrella</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Borrar">
            <AdminForm action={deleteIngredientAction.bind(null, ingredient.code)} submitLabel={null}>
              <p className="text-sm text-ink-muted">Va a la papelera. No se puede mientras esté en la lista de un producto.</p>
              <SubmitButton variant="danger" confirm="¿Enviar el ingrediente a la papelera?">
                Borrar ingrediente
              </SubmitButton>
            </AdminForm>
          </Card>
        </div>
      </fieldset>
    </>
  )
}
