import type { OrderStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/commerce/order-status'
import { Badge } from '@/components/admin/ui'

const TONES: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  PREPARING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  PARTIALLY_REFUNDED: 'danger',
  REFUNDED: 'danger',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>
}

const PAYMENT_LABELS: Record<string, string> = {
  created: 'Sin pagar',
  approved: 'Aprobado',
  pending: 'Pendiente',
  in_process: 'En revisión',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Devuelto',
  charged_back: 'Contracargo',
  awaiting_transfer: 'Esperando transferencia',
  receipt_uploaded: 'Comprobante para revisar',
}

export const paymentLabel = (status: string | null | undefined) => (status ? (PAYMENT_LABELS[status] ?? status) : '—')
