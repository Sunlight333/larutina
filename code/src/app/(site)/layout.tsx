import { siteAccess } from '@/server/site-access'
import { ToastProvider } from '@/components/toast'
import { AnnouncementBar } from '@/components/site/announcement-bar'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { TeamBar } from '@/components/site/team-bar'
import { ReferralCapture } from '@/components/site/referral-capture'
import { MaintenancePage, WaitlistModalContent } from '@/components/site/closed-pages'
import { WaitlistModal } from '@/components/site/waitlist-modal'
import { getAnnouncements } from '@/server/services/site'

// The storefront. Maintenance mode shows visitors the maintenance page (the
// proxy already sends them to /proximamente; this is the second line, GEN-09).
// Waitlist mode keeps the site open and shows visitors the waitlist in a
// window they can skip (GEN-08). The team gets a bar saying which mode is on.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const access = await siteAccess()
  if (!access.canSeeSite) return <MaintenancePage />

  const announcements = await getAnnouncements()
  return (
    <ToastProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Ir al contenido principal
      </a>
      {access.mode !== 'open' && (access.team || access.preview) && <TeamBar mode={access.mode} isAdmin={!!access.team} />}
      {announcements.length > 0 && <AnnouncementBar messages={announcements} />}
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <ReferralCapture />
      {access.showWaitlist && (
        <WaitlistModal>
          <WaitlistModalContent />
        </WaitlistModal>
      )}
    </ToastProvider>
  )
}
