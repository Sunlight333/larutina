import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { currentAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { clientIp } from '@/server/request'
import { storage } from '@/server/storage'

// The licence or title attached to an ambassador application (EB-09).
// Private: admins with the ambassadors permission only, never cached, each
// view recorded (ADM-03).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin || !admin.mfaPassed) return new Response('No autorizado', { status: 401 })
  if (!can(admin.role, 'ambassadors.manage')) return new Response('Sin permiso', { status: 403 })
  const { id } = await ctx.params
  const db = getDb()
  const a = await db.ambassador.findUnique({ where: { id }, select: { licenseFile: true, email: true } })
  if (!a?.licenseFile) return new Response('No encontrado', { status: 404 })
  const data = await storage().get(a.licenseFile)
  if (!data) return new Response('No encontrado', { status: 404 })
  const asset = await db.mediaAsset.findUnique({ where: { key: a.licenseFile } })
  const type = asset?.mimeType && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(asset.mimeType) ? asset.mimeType : 'application/octet-stream'
  await audit(db, admin, { action: 'view-attachment', entityType: 'Ambassador', entityId: id, label: `Archivo de la postulación de ${a.email}`, ip: await clientIp() })
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': type, 'Content-Length': String(data.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" },
  })
}
