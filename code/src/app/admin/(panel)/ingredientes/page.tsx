import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { KeepInput } from '@/components/admin/keep-input'
import { DataTable, FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { Badge, Card, Notice, PageHeader } from '@/components/admin/ui'
import { createIngredientAction, reviewIngredientAction } from './actions'
import { IngredientFields } from './fields'

export const metadata = { title: 'Ingredientes' }

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const db = getDb()
  const page = pageOf(sp)
  const q = param(sp, 'q')?.trim()
  const status = param(sp, 'estado')
  const family = param(sp, 'familia')
  const where: Prisma.IngredientWhereInput = { deletedAt: null }
  if (q) where.OR = [{ commonName: { contains: q, mode: 'insensitive' } }, { inciName: { contains: q, mode: 'insensitive' } }, { code: { contains: q.toLowerCase() } }]
  if (status === 'REVIEW' || status === 'ACTIVE') where.status = status
  if (family) where.family = { code: family }
  const [total, rows, families, concerns, toReview] = await Promise.all([
    db.ingredient.count({ where }),
    db.ingredient.findMany({ where, orderBy: [{ status: 'desc' }, { commonName: 'asc' }], skip: page.skip, take: page.take, include: { family: true, _count: { select: { products: true } } } }),
    db.ingredientFamily.findMany({ orderBy: { name: 'asc' } }),
    db.concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    db.ingredient.count({ where: { deletedAt: null, status: 'REVIEW' } }),
  ])
  const canEdit = can(admin.role, 'catalog.edit')
  return (
    <>
      <PageHeader title="Ingredientes" description="Los nombres nuevos de las listas INCI llegan para revisar: completá su nombre común, familia y descripción y marcalos como revisados." />
      <div className="mb-4 space-y-3">
        {sp.borrado !== undefined && <Notice tone="success">Ingrediente enviado a la papelera.</Notice>}
        {toReview > 0 && status !== 'REVIEW' && (
          <Notice tone="warning">
            Hay {toReview} {toReview === 1 ? 'ingrediente' : 'ingredientes'} para revisar.{' '}
            <Link href="/admin/ingredientes?estado=REVIEW" className="underline">
              Ver solo esos
            </Link>
          </Notice>
        )}
      </div>
      <FilterBar
        sp={sp}
        placeholder="Buscar por nombre común, INCI o código"
        selects={[
          { name: 'estado', label: 'Estado', options: [{ value: 'REVIEW', label: 'Para revisar' }, { value: 'ACTIVE', label: 'Revisados' }] },
          { name: 'familia', label: 'Familia', options: families.map((f) => ({ value: f.code, label: f.name })) },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div>
          <DataTable
            rows={rows}
            rowKey={(i) => i.id}
            empty="No hay ingredientes con esos filtros."
            columns={[
              {
                key: 'name',
                label: 'Ingrediente',
                render: (i) => (
                  <div>
                    <Link href={`/admin/ingredientes/${i.code}`} className="font-medium underline-offset-2 hover:underline">
                      {i.commonName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {i.inciName} · {i.code}
                    </p>
                  </div>
                ),
              },
              { key: 'family', label: 'Familia', render: (i) => i.family?.name ?? '—' },
              {
                key: 'flags',
                label: '',
                render: (i) => (
                  <div className="flex flex-wrap gap-1">
                    {i.isKeyActive && <Badge tone="info">Activo clave</Badge>}
                    {i.isIrritant && <Badge tone="warning">Irritante</Badge>}
                  </div>
                ),
              },
              { key: 'products', label: 'Productos', className: 'text-right tabular-nums', render: (i) => i._count.products },
              {
                key: 'status',
                label: 'Estado',
                render: (i) =>
                  i.status === 'REVIEW' ? (
                    canEdit ? (
                      <AdminForm action={reviewIngredientAction.bind(null, i.code)} submitLabel={null} className="space-y-1">
                        <Badge tone="warning">Nuevo · revisar</Badge>
                        <SubmitButton variant="ghost">Marcar como revisado</SubmitButton>
                      </AdminForm>
                    ) : (
                      <Badge tone="warning">Nuevo · revisar</Badge>
                    )
                  ) : (
                    <Badge tone="success">Revisado</Badge>
                  ),
              },
            ]}
          />
          <Pagination basePath="/admin/ingredientes" sp={sp} total={total} page={page.page} size={page.size} />
        </div>
        {canEdit && (
          <Card title="Nuevo ingrediente">
            <AdminForm action={createIngredientAction} submitLabel="Crear ingrediente">
              <KeepInput />
              <TextField name="code" label="Código" required help="Minúsculas, números y guiones. No se cambia después." />
              <IngredientFields families={families.map((f) => ({ value: f.id, label: f.name }))} concerns={concerns.map((c) => ({ value: c.id, label: c.name }))} />
            </AdminForm>
          </Card>
        )}
      </div>
    </>
  )
}
