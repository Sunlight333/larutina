import { currentAdmin, type AdminSessionUser } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'

// Shared by the CSV export routes: the same checks as requireAdmin (signed
// in, two-step verification, permission), answered as HTTP statuses.

export async function exportAdmin(): Promise<AdminSessionUser | Response> {
  const admin = await currentAdmin()
  if (!admin || !admin.mfaPassed) return new Response('No autorizado', { status: 401 })
  if (!can(admin.role, 'subscribers.export')) return new Response('Sin permiso', { status: 403 })
  return admin
}

export function csvResponse(csv: string, name: string) {
  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${date}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
