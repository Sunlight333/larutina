import type { MetadataRoute } from 'next'
import { getSettings } from '@/server/settings'

export const dynamic = 'force-dynamic'

// Closed to crawlers until launch: the "indexing" setting is off, or the site
// is in waitlist or maintenance mode. The panel is never crawled.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings()
  const open = s['site.indexing'] && !s['site.waitlistMode'] && !s['site.maintenanceMode']
  if (!open) return { rules: [{ userAgent: '*', disallow: '/' }] }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/vista-previa'] }], sitemap: `${base}/sitemap.xml` }
}
