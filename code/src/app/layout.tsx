import type { Metadata, Viewport } from 'next'
import { Newsreader } from 'next/font/google'
import { getSettings } from '@/server/settings'
import { mediaUrl } from '@/server/media'
import './globals.css'

// The site's display face, Newsreader, with its optical-size axis and the full
// weight range (headings use 500). next/font downloads it at build time and
// serves it from this site: no request to Google from the browser.
const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
  fallback: ['Georgia', 'serif'],
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
    <html lang="es-AR" className={newsreader.variable}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">{children}</body>
    </html>
  )
}
