import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkle } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { ReviewForm } from '@/components/account/review-form'
import { one, type SearchParams } from '@/components/account/params'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { reviewableLines, USAGE_TIMES } from '@/server/commerce/aftersale'
import { currentCustomer } from '@/server/customers/session'
import { signInHref } from '@/lib/return-path'

export const metadata: Metadata = { title: 'Escribí tu reseña', robots: { index: false, follow: false }, referrer: 'no-referrer' }

type Props = { params: Promise<{ number: string }>; searchParams: Promise<SearchParams> }

// F-22, PDP-07: from the review-request email (EM-07, a signed link) or from
// her orders when signed in. One form per product of a delivered order not
// reviewed yet; reviews are published after the team checks them.
export default async function ReviewPage({ params, searchParams }: Props) {
  const [{ number }, sp, customer] = await Promise.all([params, searchParams, currentCustomer()])
  const token = one(sp.t)
  const db = getDb()
  const found = await reviewableLines(db, decodeURIComponent(number), { token, customerId: customer?.id ?? null })
  const images = found ? await resolveImages(db, found.lines.map((l) => l.image ?? '').filter(Boolean)) : new Map()
  const steps = found
    ? new Map((await db.product.findMany({ where: { id: { in: found.lines.map((l) => l.productId!) } }, select: { id: true, routineStep: true } })).map((p) => [p.id, p.routineStep]))
    : new Map()

  return (
    <div className="tex-grain">
      <header className="tex-linen bg-shell">
        <div className="container-page pb-10 pt-8 md:pb-14 md:pt-12">
          <p className="eyebrow">Reseñas</p>
          <h1 className="mt-3 font-display text-display-lg text-balance">Escribí tu reseña</h1>
          {found && <p className="mt-3 text-lede text-ink-soft tabular">Pedido #{found.order.number}</p>}
        </div>
      </header>
      <div className="container-page py-10 md:py-14">
        {!found || found.lines.length === 0 ? (
          <div className="max-w-xl space-y-5">
            <p className="text-lede text-ink-soft">Este producto ya tiene tu reseña o no se puede reseñar desde este link.</p>
            {!customer && (
              <ButtonLink href={signInHref(`/resenas/${encodeURIComponent(number)}`)} variant="secondary">
                Ingresá a tu cuenta
              </ButtonLink>
            )}
            {customer && (
              <Link href="/cuenta/pedidos" className="inline-block font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Pedidos
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {found.lines.map((l, i) => (
              <li key={l.id} className={`bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8 ${i % 2 ? 'rounded-[3rem_1.5rem_3rem_1.5rem]' : 'rounded-[1.5rem_3rem_1.5rem_3rem]'}`}>
                <div className="mb-6 flex items-center gap-4">
                  <ProductImage image={l.image ? images.get(l.image) : null} alt="" step={steps.get(l.productId!) ?? 'TREATMENT'} sizes="80px" shape="arch" className="w-20 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{l.brandName}</p>
                    <h2 className="mt-1 font-display text-[1.35rem] leading-snug text-balance">{l.productName}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                      <Sparkle size={15} /> {l.sizeLabel}
                    </p>
                  </div>
                </div>
                <ReviewForm number={found.order.number} token={token} line={l.id} usageTimes={USAGE_TIMES} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
