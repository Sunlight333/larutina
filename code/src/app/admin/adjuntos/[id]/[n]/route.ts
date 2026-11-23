import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { currentAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { clientIp } from '@/server/request'
import { storage } from '@/server/storage'
import { getAttachment } from '@/server/services/content/contact'

// A photo attached to a contact message (CMS-03). Private: only a signed-in
// admin with two-step verification and the messages permission gets it,
// never cached, and each view is recorded (ADM-03).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const admin = await currentAdmin()
  if (!admin || !admin.mfaPassed) return new Response('No autorizado', { status: 401 })
  if (!can(admin.role, 'messages.view')) return new Response('Sin permiso', { status: 403 })
  const { id, n } = await ctx.params
  if (!/^\d$/.test(n)) return new Response('No encontrado', { status: 404 })
  const db = getDb()
  const found = await getAttachment(db, id, Number(n))
  if (!found) return new Response('No encontrado', { status: 404 })
  const data = await storage().get(found.asset.key)
  if (!data) return new Response('No encontrado', { status: 404 })
  await audit(db, admin, { action: 'view-attachment', entityType: 'ContactMessage', entityId: id, label: `${found.asset.fileName} de ${found.message.email}`, ip: await clientIp() })
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': found.asset.mimeType,
      'Content-Length': String(data.length),
      'Content-Disposition': `inline; filename="${found.asset.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
