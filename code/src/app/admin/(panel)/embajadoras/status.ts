import type { AmbassadorStatus } from '@prisma/client'

export const AMB_STATUS: Record<AmbassadorStatus, { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }> = {
  PENDING: { label: 'Para revisar', tone: 'warning' },
  APPROVED: { label: 'Activa', tone: 'success' },
  REJECTED: { label: 'No aprobada', tone: 'neutral' },
  LEFT: { label: 'De baja', tone: 'neutral' },
}
