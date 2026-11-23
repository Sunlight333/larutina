import type { MetadataRoute } from 'next'
import { getSettings } from '@/server/settings'
import { getSitemapEntries } from '@/server/services/catalog/sitemap'
import { absoluteUrl } from '@/server/services/catalog/seo'

// Read per request: the catalog changes from the panel, and the build has no database.
export const dynamic = 'force-dynamic'

// Empty until launch: the site must be open (no waitlist, no maintenance)
// and the panel must allow indexing, the same rule as robots.txt.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings()
  const open = s['site.indexing'] && !s['site.waitlistMode'] && !s['site.maintenanceMode']
  if (!open || !process.env.DATABASE_URL) return []
  const entries = await getSitemapEntries()
  return entries.map((e) => ({ url: absoluteUrl(e.path), lastModified: e.lastModified }))
}
