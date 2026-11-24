import type { ReactNode } from 'react'
import { IconBadge } from '@/components/icons'

export function AuthHeading({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <IconBadge size="lg">{icon}</IconBadge>
      <h1 className="mt-5 font-display text-display-md text-balance">{title}</h1>
      {children && <div className="mt-3 text-lede text-ink-soft">{children}</div>}
    </div>
  )
}
