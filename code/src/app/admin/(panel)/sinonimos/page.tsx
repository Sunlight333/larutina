import Link from 'next/link'
import type { Prisma, SynonymType } from '@prisma/client'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { SYNONYM_TYPES } from '@/server/services/admin/catalog/synonyms'
import { AdminForm } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { DataTable, FilterBar, param, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { createSynonymAction } from './actions'
import { SynonymFields } from './fields'

export const metadata = { title: 'Sinónimos del buscador' }

export default async function SynonymsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const sp = await searchParams
  const q = param(sp, 'q')?.trim()
  const type = param(sp, 'tipo')
  const where: Prisma.SynonymWhereInput = {}
  if (q) where.OR = [{ term: { contains: q, mode: 'insensitive' } }, { targetCode: { contains: q.toLowerCase() } }, { variants: { has: q } }]
  if (type && SYNONYM_TYPES.some((t) => t.value === type)) where.type = type as SynonymType
  const rows = await getDb().synonym.findMany({ where, orderBy: [{ type: 'asc' }, { term: 'asc' }], take: 500 })
  const typeLabel = (t: SynonymType) => SYNONYM_TYPES.find((x) => x.value === t)?.label ?? t
  return (
    <>
      <PageHeader title="Sinónimos del buscador" description="Cómo escribe la gente cada concepto del catálogo: el buscador y el asistente los usan para encontrarlo." />
      {sp.borrado !== undefined && (
        <div className="mb-4">
          <Notice tone="success">Sinónimo borrado.</Notice>
        </div>
      )}
      <FilterBar sp={sp} placeholder="Buscar término, código o sinónimo" selects={[{ name: 'tipo', label: 'Tipo', options: SYNONYM_TYPES }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          empty="Todavía no hay sinónimos."
          columns={[
            {
              key: 'term',
              label: 'Término',
              render: (s) => (
                <Link href={`/admin/sinonimos/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                  {s.term}
                </Link>
              ),
            },
            { key: 'type', label: 'Tipo', render: (s) => typeLabel(s.type) },
            { key: 'target', label: 'Destino', render: (s) => <code className="text-xs">{s.targetCode}</code> },
            { key: 'variants', label: 'Sinónimos', render: (s) => <span className="text-ink-soft">{s.variants.join(', ')}</span> },
          ]}
        />
        {can(admin.role, 'catalog.edit') && (
          <Card title="Nuevo sinónimo">
            <AdminForm action={createSynonymAction} submitLabel="Crear sinónimo" resetOnSuccess>
              <KeepInput />
              <SynonymFields />
            </AdminForm>
          </Card>
        )}
      </div>
    </>
  )
}
