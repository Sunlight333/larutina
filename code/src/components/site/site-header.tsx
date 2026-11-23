import Link from 'next/link'
import { getSettings } from '@/server/settings'
import { Wordmark } from '@/components/site/wordmark'
import { SearchBox } from '@/components/site/search-box'
import { CartLink } from '@/components/cart/cart-link'
import { Menu } from '@/components/icons'
import { whatsappLink } from '@/lib/whatsapp'

// G-02 to G-06. Menu items come from the panel (navigation.menu); the one
// marked "destacado" (Diagnóstico) is a button.
export async function SiteHeader() {
  const s = await getSettings()
  const menu = s['navigation.menu']
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="container-page flex h-16 items-center gap-4">
        <details className="group md:hidden">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full hover:bg-shell [&::-webkit-details-marker]:hidden" aria-label="Menú">
            <Menu size={20} />
          </summary>
          <nav className="fixed inset-x-0 top-16 z-40 border-b border-line bg-paper px-4 pb-6 pt-2 shadow-lg" aria-label="Menú principal">
            <ul className="divide-y divide-line">
              {menu.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`block py-3.5 text-base ${item.highlight ? 'font-medium text-accent-ink' : ''}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {wa && (
              <a href={wa} className="mt-4 block text-sm text-ink-soft underline underline-offset-2">
                ¿Dudas? Escribinos por WhatsApp
              </a>
            )}
          </nav>
        </details>

        <Link href="/" className="shrink-0" aria-label={`${s['brand.name']}, inicio`}>
          <Wordmark name={s['brand.name']} />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Menú principal">
          {menu.map((item) =>
            item.highlight ? (
              <Link key={item.href} href={item.href} className="ml-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-soft">
                {item.label}
              </Link>
            ) : (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:bg-shell hover:text-ink">
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchBox placeholder={s['copy.searchPlaceholder']} />
          <CartLink />
        </div>
      </div>
    </header>
  )
}
