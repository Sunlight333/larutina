// The order states (PED-01) and the moves between them. Pure. Every move goes
// through `canMove`, and every move is recorded as an OrderEvent with its
// author (server/services/commerce/orders.ts).
//
// Money taken is never "cancelled": a paid order leaves through a refund.
// A partial refund does not stop the shipment, so a partially refunded order
// can still move on to preparing, shipped and delivered.

import type { OrderStatus } from '@prisma/client'

export const ORDER_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED']

const MOVES: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'SHIPPED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  PREPARING: ['SHIPPED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  DELIVERED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_REFUNDED: ['PREPARING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return MOVES[from].includes(to)
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return MOVES[from]
}

/** What the customer reads (CU, "Mis pedidos"). */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Esperando pago',
  PAID: 'Pagado',
  PREPARING: 'En preparación',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  REFUNDED: 'Reembolsado',
}

/** Paid money is in: the order counts as a sale. */
export const isPaid = (s: OrderStatus) => s !== 'PENDING_PAYMENT' && s !== 'CANCELLED'
/** The order can still change on the customer's side (address, cancellation). */
export const isOpen = (s: OrderStatus) => s === 'PENDING_PAYMENT' || s === 'PAID' || s === 'PREPARING'
