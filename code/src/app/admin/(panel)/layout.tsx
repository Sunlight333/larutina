import Link from 'next/link'
import { requireAdmin } from '@/server/auth/session'
import { siteHref } from '@/lib/hosts'
import { can, ROLE_LABELS } from '@/server/auth/permissions'
import { LogoFull } from '@/components/site/logo'
import { logout } from '../login/actions'
import { NAV } from './nav'
import { AdminNavLink } from './nav-link'

export const metadata = { title: { default: 'Panel', template: '%s · Panel' }, robots: { index: false, follow: false } }

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(admin.role, i.permission)) })).filter((g) => g.items.length)
  return (
    <div className="min-h-dvh bg-shell lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Inicio del panel">
            <LogoFull className="w-32" alt="" />
          </Link>
          <a href={siteHref('/')} className="text-xs text-ink-muted underline underline-offset-2">
            Ver sitio
          </a>
        </div>
        <details className="group lg:hidden" >
          <summary className="cursor-pointer px-5 pb-3 text-sm font-medium">Menú</summary>
          <PanelNav groups={groups} />
        </details>
        <div className="hidden lg:block">
          <PanelNav groups={groups} />
        </div>
        <div className="border-t border-line px-5 py-4 text-sm">
          <p className="font-medium">{admin.name}</p>
          <p className="text-xs text-ink-muted">{ROLE_LABELS[admin.role]}</p>
          <form action={logout} className="mt-2">
            <button className="text-xs text-ink-muted underline">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main id="contenido" className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}

function PanelNav({ groups }: { groups: typeof NAV }) {
  return (
    <nav aria-label="Panel" className="space-y-5 px-3 pb-5">
      {groups.map((g) => (
        <div key={g.label || 'inicio'}>
          {g.label && <p className="px-2 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <AdminNavLink href={i.href}>{i.label}</AdminNavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
