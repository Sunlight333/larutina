// What the panel does to an order (PED-01, ENV-05): every change goes through
// the order's state machine and is recorded with the admin who made it.
import type { PrismaClient } from '@prisma/client'
import { addOrderEvent, lockOrder, moveOrder, type OrderActor } from '@/server/commerce/orders'
import type { CancelReason } from '@/server/email/templates'

type Admin = { id: string; email: string }
const actorOf = (a: Admin): OrderActor => ({ type: 'ADMIN', id: a.id, label: a.email })

export async function startPreparing(db: PrismaClient, admin: Admin, orderId: string) {
  return db.$transaction((tx) => moveOrder(tx, orderId, 'PREPARING', actorOf(admin), { message: 'En preparación' }))
}

export async function cancelUnpaid(db: PrismaClient, admin: Admin, orderId: string, reason: CancelReason, note: string) {
  return db.$transaction((tx) => moveOrder(tx, orderId, 'CANCELLED', actorOf(admin), { message: note || 'Cancelado desde el panel', cancelReason: reason }))
}

/** ENV-05: what the provider's API does not do, by hand: carrier, tracking code and link. */
export async function saveTracking(db: PrismaClient, admin: Admin, orderId: string, input: { carrier: string; trackingCode: string; trackingUrl: string }) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    const data = { carrier: input.carrier.trim() || null, trackingCode: input.trackingCode.trim() || null, trackingUrl: /^https?:\/\//.test(input.trackingUrl.trim()) ? input.trackingUrl.trim() : null }
    if (order.shipment) await tx.shipment.update({ where: { id: order.shipment.id }, data })
    else await tx.shipment.create({ data: { orderId, provider: 'manual', ...data } })
    await addOrderEvent(tx, orderId, actorOf(admin), { type: 'shipment', message: `Seguimiento: ${[data.carrier, data.trackingCode].filter(Boolean).join(' · ') || 'sin datos'}`, data })
  })
}

export async function markDispatched(db: PrismaClient, admin: Admin, orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    const now = new Date()
    if (order.shipment) await tx.shipment.update({ where: { id: order.shipment.id }, data: { status: 'DISPATCHED', dispatchedAt: now } })
    else await tx.shipment.create({ data: { orderId, provider: 'manual', status: 'DISPATCHED', dispatchedAt: now } })
    return moveOrder(tx, orderId, 'SHIPPED', actorOf(admin), { message: 'Despachado' })
  })
}

export async function markDelivered(db: PrismaClient, admin: Admin, orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    if (order.shipment) await tx.shipment.update({ where: { id: order.shipment.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
    return moveOrder(tx, orderId, 'DELIVERED', actorOf(admin), { message: 'Entregado' })
  })
}

export async function addNote(db: PrismaClient, admin: Admin, orderId: string, note: string) {
  if (!note.trim()) return
  await db.$transaction((tx) => addOrderEvent(tx, orderId, actorOf(admin), { type: 'note', message: note.trim().slice(0, 2000) }))
}
