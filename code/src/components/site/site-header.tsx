import Link from 'next/link'
import { getSettings, type LinkItem } from '@/server/settings'
import { SearchBox } from '@/components/site/search-box'
import { CartLink } from '@/components/cart/cart-link'
import { LogoMark } from '@/components/site/logo'
import { HeaderShell } from '@/components/site/header-shell'
import { MobileMenu } from '@/components/site/mobile-menu'
import { whatsappLink } from '@/lib/whatsapp'

// G-02 to G-06. A symmetric header around the brand's emblem: the emblem sits
// in the centre, large, in a cream medallion that rests on the header's
// bottom line; the menu from the panel (navigation.menu) is split evenly to
// either side, search on the far left and the cart on the far right, and the
// item marked "destacado" (Diagnóstico) closes the right side as a button.
// Equal side columns keep the emblem on the page's exact centre whatever the
// menu holds. On scroll the medallion shrinks into the bar.

function split(menu: LinkItem[]) {
  const regular = menu.filter((i) => !i.highlight)
  const half = Math.ceil(regular.length / 2)
  return { left: regular.slice(0, half), right: regular.slice(half), highlighted: menu.filter((i) => i.highlight) }
}

function NavLink({ item }: { item: LinkItem }) {
  return (
    <Link
      href={item.href}
      className="group/link relative whitespace-nowrap px-2.5 py-2 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink xl:px-3.5"
    >
      {item.label}
      <span
        aria-hidden="true"
        className="absolute inset-x-2.5 -bottom-0.5 h-px origin-center scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover/link:scale-x-100 xl:inset-x-3.5"
      />
    </Link>
  )
}

export async function SiteHeader() {
  const s = await getSettings()
  const { left, right, highlighted } = split(s['navigation.menu'])
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  const brand = s['brand.fullName']

  return (
    <HeaderShell>
      <div className="relative border-b border-line bg-paper/92 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
        {/* A thin terracotta rule under the bar, echoing the line under the wordmark. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />

        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 transition-[height] duration-300 lg:h-[5.5rem] group-data-[scrolled=true]/header:lg:h-[4.25rem]">
          {/* Left: mobile menu + search, or search + first half of the menu. */}
          <div className="flex min-w-0 items-center gap-1 lg:gap-2">
            <div className="lg:hidden">
              <MobileMenu items={s['navigation.menu']} whatsapp={wa} mark={<LogoMark className="size-14" alt={brand} />} />
            </div>
            <SearchBox placeholder={s['copy.searchPlaceholder']} />
            <nav aria-label="Menú principal" className="hidden items-center lg:flex">
              {left.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </div>

          {/* Centre: the emblem in its medallion. */}
          <Link href="/" aria-label={`${brand}, inicio`} className="relative z-10 grid place-items-center self-start rounded-full outline-offset-4">
            <span
              className={[
                'grid place-items-center rounded-full bg-paper ring-1 ring-line',
                'shadow-[0_14px_34px_-16px_rgb(62_44_34/0.55)] transition-all duration-300 ease-out',
                // Mobile: 76 px medallion hanging 14 px under a 64 px bar.
                'mt-1 size-[4.75rem] p-1',
                // Desktop: 124 px medallion hanging 36 px under an 88 px bar.
                'lg:mt-1.5 lg:size-[7.75rem] lg:p-1.5',
                // Scrolled: it settles into the bar.
                'group-data-[scrolled=true]/header:mt-1.5 group-data-[scrolled=true]/header:size-[3.25rem] group-data-[scrolled=true]/header:p-0.5 group-data-[scrolled=true]/header:shadow-none group-data-[scrolled=true]/header:ring-0',
                'group-data-[scrolled=true]/header:lg:mt-1.5 group-data-[scrolled=true]/header:lg:size-[3.75rem]',
              ].join(' ')}
            >
              <LogoMark className="size-full" priority sizes="(min-width: 1024px) 124px, 76px" />
            </span>
          </Link>

          {/* Right: second half of the menu, the highlighted item, the cart. */}
          <div className="flex min-w-0 items-center justify-end gap-1 lg:gap-2">
            <nav aria-label="Menú secundario" className="hidden items-center lg:flex">
              {right.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
            {highlighted.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="ml-1 hidden h-10 items-center rounded-full bg-ink px-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-paper shadow-[0_8px_20px_-10px_rgb(62_44_34/0.7)] transition-colors hover:bg-accent-ink lg:inline-flex"
              >
                {item.label}
              </Link>
            ))}
            <CartLink />
          </div>
        </div>
      </div>
    </HeaderShell>
  )
}
