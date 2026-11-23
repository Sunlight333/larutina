import { siteAccess } from '@/server/site-access'
import { ToastProvider } from '@/components/toast'
import { AnnouncementBar } from '@/components/site/announcement-bar'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { TeamBar } from '@/components/site/team-bar'
import { MaintenancePage, WaitlistPage } from '@/components/site/closed-pages'
import { getAnnouncements } from '@/server/services/site'

// The storefront. In waitlist or maintenance mode visitors get that page
// instead of any route (GEN-08, GEN-09); the team sees the site with a bar
// saying it is closed to the public.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const access = await siteAccess()
  if (!access.canSeeSite) return access.mode === 'maintenance' ? <MaintenancePage /> : <WaitlistPage />

  const announcements = await getAnnouncements()
  return (
    <ToastProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Ir al contenido principal
      </a>
      {access.mode !== 'open' && <TeamBar mode={access.mode} isAdmin={!!access.team} />}
      {announcements.length > 0 && <AnnouncementBar messages={announcements} />}
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </ToastProvider>
  )
}
