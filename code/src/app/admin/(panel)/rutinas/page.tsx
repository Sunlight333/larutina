import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { routinePrice } from '@/lib/commerce/routine'
import { formatARS } from '@/lib/money'
import { chargedCents } from '@/server/services/catalog/rules'
import { DataTable } from '@/components/admin/table'
import { AdminLink, Badge, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Rutinas armadas' }

// RUT-01: curated routines, created and edited here without development.
export default async function RoutinesAdminPage() {
  await requireAdmin('catalog.view')
  const routines = await getDb().routine.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: { steps: { include: { mainProduct: { select: { variants: { where: { isMain: true }, select: { priceCents: true, promoPriceCents: true } } } } } } },
  })
  return (
    <>
      <PageHeader title="Rutinas armadas" description="Pasos con producto principal, alternativas, instrucción y frecuencia; precio con su descuento; avisos de conflictos al guardar." actions={<AdminLink href="/rutinas/nueva" variant="primary">Nueva rutina</AdminLink>} />
      <DataTable
        rows={routines}
        rowKey={(r) => r.id}
        empty="Todavía no hay rutinas."
        columns={[
          { key: 'n', label: 'Rutina', render: (r) => <Link href={`/rutinas/${r.code}`} className="font-medium underline-offset-2 hover:underline">{r.name}<span className="block text-xs font-normal text-ink-muted">{r.goal}</span></Link> },
          { key: 's', label: 'Pasos', render: (r) => `${r.steps.length}${r.steps.some((s) => s.optional) ? ` (${r.steps.filter((s) => s.optional).length} opcionales)` : ''}` },
          {
            key: 'p',
            label: 'Precio',
            render: (r) => {
              const p = routinePrice(r.steps.map((s) => (s.mainProduct.variants[0] ? chargedCents(s.mainProduct.variants[0]) : 0)), r.discountPct)
              return <span className="tabular">{formatARS(p.priceCents)}{p.discountCents ? <span className="block text-xs text-ink-muted">Ahorro {formatARS(p.discountCents)} ({r.discountPct}%{r.discountHalves ? ', también por mitad' : ''})</span> : null}</span>
            },
          },
          { key: 'st', label: 'Estado', render: (r) => (r.status === 'PUBLISHED' ? <Badge tone="success">Publicada</Badge> : <Badge>Borrador</Badge>) },
        ]}
      />
    </>
  )
}
