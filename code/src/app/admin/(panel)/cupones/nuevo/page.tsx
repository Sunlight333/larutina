import { requireAdmin } from '@/server/auth/session'
import { Card, PageHeader } from '@/components/admin/ui'
import { CouponForm } from '../coupon-form'

export const metadata = { title: 'Nuevo cupón' }

export default async function NewCouponPage() {
  await requireAdmin('commerce.settings')
  return (
    <>
      <PageHeader title="Nuevo cupón" back={{ href: '/cupones', label: 'Cupones' }} />
      <Card>
        <CouponForm />
      </Card>
    </>
  )
}
