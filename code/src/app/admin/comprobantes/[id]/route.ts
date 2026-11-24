import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { currentAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { clientIp } from '@/server/request'
import { storage } from '@/server/storage'

// A transfer receipt uploaded by the customer (CMP-05). Private: only a
// signed-in admin with two-step verification and the orders permission gets
// it, never cached, and each view is recorded (ADM-03).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin || !admin.mfaPassed) return new Response('No autorizado', { status: 401 })
  if (!can(admin.role, 'orders.view')) return new Response('Sin permiso', { status: 403 })
  const { id } = await ctx.params
  const db = getDb()
  const payment = await db.payment.findFirst({ where: { orderId: id, receipt: { not: null } }, orderBy: { receiptAt: 'desc' }, include: { order: { select: { number: true } } } })
  if (!payment?.receipt) return new Response('No encontrado', { status: 404 })
  const data = await storage().get(payment.receipt)
  if (!data) return new Response('No encontrado', { status: 404 })
  const asset = await db.mediaAsset.findUnique({ where: { key: payment.receipt } })
  const type = asset?.mimeType && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(asset.mimeType) ? asset.mimeType : 'application/octet-stream'
  await audit(db, admin, { action: 'view-receipt', entityType: 'Order', entityId: id, label: `Comprobante del pedido #${payment.order.number}`, ip: await clientIp() })
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'Content-Disposition': `inline; filename="comprobante-${payment.order.number}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
