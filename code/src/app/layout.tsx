import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getSettings } from '@/server/settings'
import { mediaUrl } from '@/server/media'
import './globals.css'

// One family, self-hosted and cut down to what the design uses (weight 400
// with its optical-size axis, plus a small italic). Placeholder until the
// brand manual sets the type. Source: Google Fonts, SIL OFL (src/fonts/OFL.txt).
const newsreader = localFont({
  src: [
    { path: '../fonts/newsreader-roman.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/newsreader-italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-newsreader',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
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
  themeColor: '#2b2622',
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
