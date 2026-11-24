import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { getSettings } from '@/server/settings'
import { chargedCents } from '@/server/services/catalog/rules'
import { worstCase } from '@/lib/commerce/margin'
import { formatARS } from '@/lib/money'
import { DataTable } from '@/components/admin/table'
import { Badge, Notice, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Márgenes' }

// ADM-05: every variant with a cost, at the largest discount it can get
// (the larger of its routine or the best percentage code, then transfer,
// under the cap). Administración only: it shows cost. It helps set the
// total discount cap before launch (D-16).
export default async function MarginsPage() {
  await requireAdmin('catalog.cost')
  const db = getDb()
  const s = await getSettings()
  const now = new Date()
  const [variants, routines, coupons] = await Promise.all([
    db.productVariant.findMany({ where: { costCents: { not: null }, product: { deletedAt: null, status: { not: 'ARCHIVED' } } }, include: { product: { select: { id: true, code: true, name: true } } } }),
    db.routine.findMany({ where: { status: 'PUBLISHED', deletedAt: null, discountPct: { gt: 0 } }, include: { steps: { include: { alternatives: true } } } }),
    db.coupon.findMany({ where: { active: true, deletedAt: null, kind: 'PERCENT', OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, select: { value: true, combinesWithTransfer: true } }),
  ])
  const routinePct = new Map<string, number>()
  for (const r of routines) {
    for (const step of r.steps) {
      for (const id of [step.mainProductId, ...step.alternatives.map((a) => a.productId)]) routinePct.set(id, Math.max(routinePct.get(id) ?? 0, r.discountPct ?? 0))
    }
  }
  const codePct = Math.max(0, ...coupons.map((c) => c.value))
  const rows = variants
    .map((v) => {
      const charged = chargedCents(v)
      const w = worstCase({ chargedCents: charged, costCents: v.costCents!, routinePct: routinePct.get(v.product.id) ?? 0, codePct, transferPct: s['commerce.transferDiscountPct'], capPct: s['commerce.discountCapPct'] })
      return { v, charged, w }
    })
    .sort((a, b) => a.w.marginCents - b.w.marginCents)
  const below = rows.filter((r) => r.w.belowCost).length
  return (
    <>
      <PageHeader title="Márgenes" description="Cada variante con costo cargado, a su precio con el descuento más grande posible: rutina o código (el mayor), después transferencia, con el tope total." />
      <div className="mb-6 space-y-3">
        {below > 0 ? (
          <Notice tone="danger" title={`${below} ${below === 1 ? 'variante queda' : 'variantes quedan'} debajo del costo con el descuento máximo`}>
            Bajá el descuento de la rutina o del código, o fijá el tope de descuento total en Configuración → Envíos y pagos.
          </Notice>
        ) : (
          <Notice tone="success" title="Ninguna variante queda debajo del costo con el descuento máximo." />
        )}
        <p className="text-sm text-ink-muted">
          Hoy: mejor código {codePct}% · transferencia {s['commerce.transferDiscountPct']}% · tope {s['commerce.discountCapPct'] ? `${s['commerce.discountCapPct']}%` : 'sin tope'}. Los códigos de monto fijo no entran: su efecto depende del total del carrito.
        </p>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.v.id}
        empty="Ninguna variante tiene costo cargado."
        columns={[
          { key: 'p', label: 'Producto', render: (r) => <Link href={`/productos/${r.v.product.code}`} className="font-medium underline-offset-2 hover:underline">{r.v.product.name}<span className="block text-xs font-normal text-ink-muted">{r.v.sku}</span></Link> },
          { key: 'price', label: 'Precio', render: (r) => <span className="tabular">{formatARS(r.charged)}</span> },
          { key: 'd', label: 'Descuento máximo', render: (r) => `${r.w.discountPct}%` },
          { key: 'low', label: 'Precio mínimo', render: (r) => <span className="tabular">{formatARS(r.w.lowestCents)}</span> },
          { key: 'cost', label: 'Costo', render: (r) => <span className="tabular">{formatARS(r.v.costCents!)}</span> },
          { key: 'm', label: 'Margen', render: (r) => (r.w.belowCost ? <Badge tone="danger">−{formatARS(-r.w.marginCents)}</Badge> : <span className="tabular">{formatARS(r.w.marginCents)}</span>) },
        ]}
      />
    </>
  )
}
