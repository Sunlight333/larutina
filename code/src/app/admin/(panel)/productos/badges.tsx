import type { ProductStatus } from '@prisma/client'
import type { Completeness } from '@/server/services/admin/catalog/completeness'
import { statusLabel } from '@/server/services/admin/catalog/products'
import { Badge } from '@/components/admin/ui'

const STATUS_TONE: Record<ProductStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  PRESALE: 'info',
  SOLD_OUT: 'warning',
  ARCHIVED: 'danger',
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
}

export function CompletenessBadge({ completeness }: { completeness: Completeness }) {
  const { percent, missing } = completeness
  const title = missing.length ? `Falta: ${missing.map((m) => m.label).join(', ')}` : 'Completo para el catálogo final'
  return (
    <span title={title} className="inline-flex items-center gap-2 text-sm tabular-nums">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-shell" aria-hidden>
        <span className={`block h-full ${percent === 100 ? 'bg-sage-ink' : percent >= 70 ? 'bg-accent-ink' : 'bg-ink-muted'}`} style={{ width: `${percent}%` }} />
      </span>
      {percent}%<span className="sr-only">. {title}</span>
    </span>
  )
}
