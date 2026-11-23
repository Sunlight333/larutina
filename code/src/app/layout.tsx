import type { Metadata, Viewport } from 'next'
import { Fraunces, Montserrat } from 'next/font/google'
import { getSettings } from '@/server/settings'
import { mediaUrl } from '@/server/media'
import './globals.css'

// Type from the logo (see globals.css). next/font downloads both at build time
// and serves them from this site: no request to Google from the browser.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-montserrat',
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
  themeColor: '#fbf7f2',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${montserrat.variable}`}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">{children}</body>
    </html>
  )
}
