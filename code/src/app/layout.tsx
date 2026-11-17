import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { SiteHeader, type NavConcern } from '@/components/site/header'
import { DemoBanner, SiteFooter } from '@/components/site/site-chrome'
import { CONCERNS } from '@/lib/catalog/coverage'
import { lifestyleImage } from '@/lib/images'
import { getCatalog } from '@/server/services/catalog'
import { ToastProvider } from '@/components/toast'
import './globals.css'

// One family (plan §8), self-hosted and cut down to what the design uses:
// weight 400 only, keeping the optical-size axis so display sizes get the
// display cut. Roman is the Latin subset (56 KB); italic is subset to the few
// words set in italic (6 KB). The full variable family was 273 KB. Source:
// Google Fonts, SIL Open Font License (src/fonts/OFL.txt).
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LaRutina Beauty · Demo técnica',
    template: '%s · LaRutina Beauty (demo)',
  },
  description: 'Diagnóstico de piel y rutina armada a partir de datos de producto. Demo técnica con productos y marcas de ejemplo.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'LaRutina Beauty · Demo',
    title: 'Tu rutina, armada para tu piel',
    description: 'Seis preguntas, una rutina de mañana y de noche, y el motivo de cada producto. Demo técnica.',
  },
}

export const viewport: Viewport = {
  themeColor: '#2b2622',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The menu's concern links carry their portrait so the mega menu can show it.
  const { concerns } = await getCatalog()
  const navConcerns: NavConcern[] = CONCERNS.flatMap((slug) => {
    const c = concerns.find((x) => x.slug === slug)
    if (!c) return []
    const img = lifestyleImage(slug)
    return [{ slug, name: c.name, description: c.description ?? '', image: { src: img.src, blur: img.blur, width: img.width, height: img.height, face: img.face } }]
  })
  const diagnosis = lifestyleImage('diagnostico')

  return (
    <html lang="es-AR" className={newsreader.variable}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Saltar al contenido
        </a>
        <ToastProvider>
          <DemoBanner />
          <SiteHeader concerns={navConcerns} diagnosisImage={{ src: diagnosis.src, blur: diagnosis.blur }} />
          <main id="contenido" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  )
}
