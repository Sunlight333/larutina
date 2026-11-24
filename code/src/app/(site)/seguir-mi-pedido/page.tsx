import type { Metadata } from 'next'
import { IconBadge } from '@/components/icons'
import { Box } from '@/components/checkout/icons'
import { leafPanel } from '@/components/checkout/ui'
import { LookupForm } from '@/components/orders/lookup-form'
import { lookupOrder } from './actions'

export const metadata: Metadata = { title: 'Seguí tu pedido', robots: { index: false, follow: true } }

type Props = { searchParams: Promise<{ pedido?: string | string[] }> }

// CU-20: for who bought without an account. Same states as "Pedidos" (CU-12).
export default async function TrackOrderPage({ searchParams }: Props) {
  const p = (await searchParams).pedido
  const number = (Array.isArray(p) ? p[0] : p) ?? ''
  return (
    <div className="container-page py-12 md:py-20">
      <div className="mx-auto grid max-w-4xl items-center gap-10 md:grid-cols-[1fr_1.1fr]">
        <div>
          <IconBadge size="xl">
            <Box />
          </IconBadge>
          <h1 className="mt-6 font-display text-display-lg">Seguí tu pedido</h1>
        </div>
        <div className={`tex-linen bg-shell p-6 shadow-[var(--shadow-soft)] sm:p-8 ${leafPanel}`}>
          <LookupForm action={lookupOrder} number={number.slice(0, 30)} />
        </div>
      </div>
    </div>
  )
}
