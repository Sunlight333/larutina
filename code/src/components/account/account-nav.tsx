'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FaceScan, Heart, Home, Layers, LogOut, Package, User } from '@/components/icons'
import { signOut } from '@/app/(site)/cuenta/actions'

// CU-07's accesses (Mi piel · Mi rutina · Pedidos · Favoritos · Mis datos),
// after the summary, and CU-18. A side card on desktop, a row of pills that
// scrolls sideways on phones.
export function AccountNav({ home }: { home: string }) {
  const pathname = usePathname()
  const items = [
    { href: '/cuenta', label: home, Icon: Home },
    { href: '/cuenta/mi-piel', label: 'Mi piel', Icon: FaceScan },
    { href: '/cuenta/mi-rutina', label: 'Mi rutina', Icon: Layers },
    { href: '/cuenta/pedidos', label: 'Pedidos', Icon: Package },
    { href: '/cuenta/favoritos', label: 'Favoritos', Icon: Heart },
    { href: '/cuenta/mis-datos', label: 'Mis datos', Icon: User },
  ]
  return (
    <nav aria-label={home}>
      <ul className="scroller -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map(({ href, label, Icon }) => {
          const on = href === '/cuenta' ? pathname === href : pathname.startsWith(href)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`group flex items-center gap-3 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[0.9375rem] font-semibold transition-colors lg:rounded-[1rem_1.75rem_1rem_1.75rem] lg:py-2 lg:text-base ${
                  on ? 'bg-ink text-paper shadow-[var(--shadow-soft)]' : 'bg-paper text-ink-soft ring-1 ring-line hover:text-ink lg:bg-transparent lg:ring-0 lg:hover:bg-paper'
                }`}
              >
                <span className={`grid size-9 place-items-center rounded-full lg:size-10 ${on ? 'bg-paper/15 text-paper' : 'bg-accent-soft text-accent-ink'}`}>
                  <Icon size={20} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
        <li className="shrink-0 lg:mt-3 lg:border-t lg:border-line lg:pt-3">
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-3 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[0.9375rem] font-semibold text-ink-soft ring-1 ring-line transition-colors hover:text-ink lg:w-full lg:rounded-[1rem_1.75rem_1rem_1.75rem] lg:py-2 lg:text-base lg:ring-0 lg:hover:bg-paper">
              <span className="grid size-9 place-items-center rounded-full bg-shell text-ink lg:size-10 lg:bg-paper">
                <LogOut size={20} />
              </span>
              Cerrar sesión
            </button>
          </form>
        </li>
      </ul>
    </nav>
  )
}
