import type { ImportStatus } from '@prisma/client'
import { Badge } from '@/components/admin/ui'

export const STAGE_LABELS: Record<string, string> = { S1: 'Muestra (S1)', S5: 'Catálogo completo (S5)' }

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  if (status === 'APPLIED') return <Badge tone="success">Importada</Badge>
  if (status === 'VALIDATED') return <Badge tone="info">Validada, sin importar</Badge>
  return <Badge tone="danger">Con errores</Badge>
}
