import { siteAccess } from '@/server/site-access'
import type { Viewer } from './product'

/**
 * Who is looking. The site layout shows the waitlist instead of the page
 * when the visitor may not see the site, but Next still renders the page
 * segment (and its metadata) into the response, so every catalog page and
 * API asks here before reading the catalog.
 */
export async function catalogViewer(): Promise<Viewer & { canSee: boolean }> {
  const a = await siteAccess()
  return { canSee: a.canSeeSite, team: !!a.team, preview: a.preview }
}

/** For pages: false while the site is closed to this visitor (render nothing, no metadata). */
export async function canSeeCatalog(): Promise<boolean> {
  return (await siteAccess()).canSeeSite
}
