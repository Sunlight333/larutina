import { redirect } from 'next/navigation'
import { siteAccess } from '@/server/site-access'
import { MaintenancePage, WaitlistPage } from '@/components/site/closed-pages'

// Where src/proxy.ts sends visitors while the site is closed. Opened directly
// when the site is open, it goes to the Home.
export default async function ClosedSitePage() {
  const access = await siteAccess()
  if (access.mode === 'open') redirect('/')
  return access.mode === 'maintenance' ? <MaintenancePage /> : <WaitlistPage />
}
