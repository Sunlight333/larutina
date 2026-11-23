'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname()
  const active = href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-md px-2 py-1.5 text-sm ${active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-shell hover:text-ink'}`}
    >
      {children}
    </Link>
  )
}
