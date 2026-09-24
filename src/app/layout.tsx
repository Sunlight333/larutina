import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { DemoBanner, SiteFooter, SiteHeader } from '@/components/site/site-chrome'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={newsreader.variable}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Saltar al contenido
        </a>
        <ToastProvider>
          <DemoBanner />
          <SiteHeader />
          <main id="contenido" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  )
}
