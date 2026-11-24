import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { AdminForm } from '@/components/admin/form'
import { Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { CouponForm } from '../coupon-form'
import { deleteCouponAction } from '../actions'

export const metadata = { title: 'Cupón' }

export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('commerce.settings')
  const { id } = await params
  const db = getDb()
  const coupon = await db.coupon.findUnique({ where: { id } })
  if (!coupon || coupon.deletedAt) notFound()
  const uses = await db.couponRedemption.findMany({ where: { couponId: id }, orderBy: { createdAt: 'desc' }, take: 50, include: { order: { select: { id: true, number: true, status: true } } } })
  return (
    <>
      <PageHeader title={coupon.code} back={{ href: '/cupones', label: 'Cupones' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CouponForm coupon={coupon} />
        </Card>
        <div className="space-y-6">
          <Card title="Últimos usos">
            {uses.length ? (
              <ul className="space-y-1 text-sm">
                {uses.map((u) => (
                  <li key={u.id}>
                    <a href={`/pedidos/${u.order.id}`} className="underline underline-offset-2">
                      #{u.order.number}
                    </a>{' '}
                    · {formatDateTime(u.createdAt)}
                    {u.order.status === 'CANCELLED' ? ' · cancelado' : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Todavía no se usó.</p>
            )}
          </Card>
          <Card title="Eliminar">
            <AdminForm action={deleteCouponAction.bind(null, coupon.id)} submitLabel="Eliminar cupón">
              <p className="text-sm text-ink-muted">Deja de funcionar enseguida. Los pedidos que ya lo usaron no cambian.</p>
            </AdminForm>
          </Card>
        </div>
      </div>
    </>
  )
}
