import Link from 'next/link'
import { ArrowRight, FaceScan, Heart, IconBadge, Layers, Package, User } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { countWord, longDate } from '@/components/account/ui'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { orderPath } from '@/server/commerce/orders'
import { lastOrder } from '@/server/customers/history'
import { requireCustomer } from '@/server/customers/web'
import { STATUS_LABELS } from '@/lib/commerce/order-status'

// CU-06, CU-07: "Hola, [Nombre]." with her routine, her last diagnosis and
// her last order, then the accesses. Saved routines and diagnoses arrive in
// Phase 3, so those two show their empty states (CU-11, CU-09).
export default async function AccountHomePage() {
  const customer = await requireCustomer('/cuenta')
  const [s, order] = await Promise.all([getSettings(), lastOrder(getDb(), customer.id)])
  const accesses = [
    { href: '/cuenta/mi-piel', label: 'Mi piel', Icon: FaceScan, shape: 'rounded-[1.25rem_2.5rem_1.25rem_2.5rem]' },
    { href: '/cuenta/mi-rutina', label: 'Mi rutina', Icon: Layers, shape: 'rounded-[2.5rem_1.25rem_2.5rem_1.25rem]' },
    { href: '/cuenta/pedidos', label: 'Pedidos', Icon: Package, shape: 'rounded-[1.25rem_2.5rem_1.25rem_2.5rem]' },
    { href: '/cuenta/favoritos', label: 'Favoritos', Icon: Heart, shape: 'rounded-[2.5rem_1.25rem_2.5rem_1.25rem]' },
    { href: '/cuenta/mis-datos', label: 'Mis datos', Icon: User, shape: 'rounded-[1.25rem_2.5rem_1.25rem_2.5rem]' },
  ]

  return (
    <>
      <header className="animate-rise mb-8 md:mb-10">
        <p className="eyebrow">Mi {s['brand.name']}</p>
        <h1 className="mt-3 font-display text-display-lg text-balance">{customer.firstName ? `Hola, ${customer.firstName}.` : 'Hola.'}</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Tu rutina" icon={<Layers size={24} />} className="rounded-[1.5rem_3rem_1.5rem_3rem] bg-shell tex-linen">
          <p>Todavía no guardaste una rutina. Hacé el diagnóstico o elegí una de nuestras rutinas armadas.</p>
          <ButtonLink href="/rutinas" variant="secondary" className="mt-5">
            Ver rutinas
          </ButtonLink>
        </SummaryCard>

        <SummaryCard title="Tu último diagnóstico" icon={<FaceScan size={24} />} dark className="rounded-[3rem_1.5rem_3rem_1.5rem]">
          <p>Todavía no hiciste el diagnóstico. Son {countWord(s['copy.diagnosisQuestions'])} preguntas.</p>
          <ButtonLink href="/diagnostico" variant="inverse" className="mt-5">
            Hacer mi diagnóstico
          </ButtonLink>
        </SummaryCard>

        <SummaryCard title="Tu último pedido" icon={<Package size={24} />} className="rounded-[1.5rem_3rem_1.5rem_3rem] bg-paper ring-1 ring-line md:col-span-2 xl:col-span-1">
          {order ? (
            <>
              <p className="font-semibold text-ink">
                Pedido #{order.number} <span className="font-normal text-ink-muted">· {longDate(order.placedAt)}</span>
              </p>
              <p className="mt-3">
                <span className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-sage-ink">{STATUS_LABELS[order.status]}</span>
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href={orderPath(order)} variant="secondary">
                  Ver detalle
                </ButtonLink>
                <ButtonLink href="/cuenta/pedidos" variant="ghost">
                  Pedidos <ArrowRight size={18} />
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p>Todavía no hiciste ningún pedido.</p>
              <ButtonLink href="/productos" variant="secondary" className="mt-5">
                Ver productos
              </ButtonLink>
            </>
          )}
        </SummaryCard>
      </div>

      <h2 className="mt-12 text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">Accesos</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {accesses.map(({ href, label, Icon, shape }, i) => (
          <li key={href} data-reveal="up" style={{ '--i': i } as React.CSSProperties}>
            <Link
              href={href}
              className={`group flex h-full flex-col items-start gap-4 bg-paper p-4 shadow-[var(--shadow-soft)] ring-1 ring-line transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:p-5 ${shape}`}
            >
              <IconBadge size="md">
                <Icon size={24} />
              </IconBadge>
              <span className="flex w-full items-center justify-between gap-2 font-display text-[1.2rem] leading-tight">
                {label}
                <ArrowRight size={18} className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function SummaryCard({ title, icon, children, className = '', dark = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <section className={`flex flex-col p-6 shadow-[var(--shadow-soft)] sm:p-7 ${dark ? 'bg-ink text-paper' : ''} ${className}`}>
      <h2 className="flex items-center gap-3 font-display text-[1.35rem] leading-tight">
        <IconBadge size="sm" tone={dark ? 'night' : 'accent'}>
          {icon}
        </IconBadge>
        {title}
      </h2>
      <div className={`mt-4 flex flex-1 flex-col items-start text-[1rem] leading-relaxed ${dark ? 'text-paper/80' : 'text-ink-soft'}`}>{children}</div>
    </section>
  )
}
