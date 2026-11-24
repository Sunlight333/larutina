import Link from 'next/link'
import { siteAccess } from '@/server/site-access'
import { getSettings } from '@/server/settings'
import { ToastProvider } from '@/components/toast'
import { MaintenancePage } from '@/components/site/closed-pages'
import { LogoMark } from '@/components/site/logo'
import { ArrowLeft } from '@/components/icons'
import { Lock } from '@/components/checkout/icons'

// CK-01: the checkout's own frame: logo · Compra segura · Volver al carrito,
// with no menu and no floating WhatsApp, so nothing pulls her away. The
// maintenance gate applies as on the rest of the storefront.
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const access = await siteAccess()
  if (!access.canSeeSite) return <MaintenancePage />
  const s = await getSettings()
  return (
    <ToastProvider>
      <header className="border-b border-line bg-paper/92 backdrop-blur-md">
        <div className="container-page grid h-18 grid-cols-[1fr_auto_1fr] items-center gap-3 md:h-22">
          <Link href="/carrito" className="inline-flex items-center gap-1.5 justify-self-start rounded-full py-2 pr-2 text-[0.8125rem] font-semibold leading-tight text-ink-soft transition-colors hover:text-ink sm:gap-2 sm:text-sm">
            <ArrowLeft size={20} className="shrink-0" />
            Volver al carrito
          </Link>
          <Link href="/" aria-label={s['brand.fullName']} className="justify-self-center">
            <LogoMark className="size-13 md:size-16" alt="" priority />
          </Link>
          <p className="inline-flex items-center gap-1.5 justify-self-end text-right text-[0.8125rem] font-semibold leading-tight text-sage-ink sm:gap-2 sm:text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sage-soft sm:size-9">
              <Lock size={18} />
            </span>
            Compra segura
          </p>
        </div>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
    </ToastProvider>
  )
}
