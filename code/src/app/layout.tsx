import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { RevealObserver } from '@/components/ui/reveal'
import { getSettings } from '@/server/settings'
import { mediaUrl } from '@/server/media'
import './globals.css'

// The site's typeface, Plus Jakarta Sans: one modern, highly legible family
// for headings (bold, tight) and text (medium), variable weight 200 to 800.
// next/font downloads it at build time and serves it from this site: no
// request to Google from the browser.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
})

// Every page reads settings, the catalog or the session: rendered per request,
// never at build time (the image is built without a database).
export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  const name = s['brand.fullName']
  const index = s['site.indexing'] && !s['site.waitlistMode'] && !s['site.maintenanceMode']
  return {
    metadataBase: new URL(siteUrl),
    title: { default: name, template: `%s · ${name}` },
    description: s['site.homeDescription'],
    robots: index ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: name,
      title: name,
      description: s['site.homeDescription'],
      images: s['site.ogImage'] ? [{ url: mediaUrl(s['site.ogImage']), width: 1200, height: 630 }] : undefined,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#faf8f5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // RevealObserver adds a class to <html> after hydration.
    <html lang="es-AR" className={jakarta.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        {children}
        <RevealObserver />
      </body>
    </html>
  )
}
