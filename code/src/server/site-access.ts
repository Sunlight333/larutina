import { randomBytes } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import type { PrismaClient } from '@prisma/client'
import { getDb } from '@/server/db'
import { teamMember } from '@/server/auth/session'
import { getSettings } from '@/server/settings'

// GEN-08 and GEN-09. Maintenance mode closes the site to visitors while the
// team keeps seeing it. Waitlist mode keeps the site open and shows visitors
// the waitlist in a window they can skip (showWaitlist). "The team" is a signed-in admin, or
// anyone who opened the preview link (/vista-previa?t=…), which is how
// LaRutina reviews the site before launch without an account.

export const PREVIEW_COOKIE = 'lr_preview'
const PREVIEW_KEY = 'internal.previewToken'

export type SiteMode = 'open' | 'waitlist' | 'maintenance'

export async function getPreviewToken(db: PrismaClient): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: PREVIEW_KEY } })
  if (row && typeof row.value === 'string') return row.value
  return rotatePreviewToken(db)
}

export async function rotatePreviewToken(db: PrismaClient): Promise<string> {
  const token = randomBytes(18).toString('base64url')
  await db.setting.upsert({ where: { key: PREVIEW_KEY }, create: { key: PREVIEW_KEY, value: token }, update: { value: token } })
  return token
}

export const siteAccess = cache(async () => {
  const settings = await getSettings()
  const mode: SiteMode = settings['site.maintenanceMode'] ? 'maintenance' : settings['site.waitlistMode'] ? 'waitlist' : 'open'
  const team = await teamMember()
  let preview = false
  if (!team) {
    const cookie = (await cookies()).get(PREVIEW_COOKIE)?.value
    preview = !!cookie && cookie === (await getPreviewToken(getDb()))
  }
  const insider = !!team || preview
  return { mode, team, preview, canSeeSite: mode !== 'maintenance' || insider, showWaitlist: mode === 'waitlist' && !insider, settings }
})
