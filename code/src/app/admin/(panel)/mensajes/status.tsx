import type { ContactStatus } from '@prisma/client'
import { Badge } from '@/components/admin/ui'
import { STATUS_LABELS } from '@/server/services/content/contact'

export function MessageStatusBadge({ status }: { status: ContactStatus }) {
  return <Badge tone={status === 'NEW' ? 'warning' : status === 'IN_PROGRESS' ? 'info' : 'neutral'}>{STATUS_LABELS[status]}</Badge>
}
