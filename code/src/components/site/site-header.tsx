import Link from 'next/link'
import { getSettings, type LinkItem } from '@/server/settings'
import { SearchBox } from '@/components/site/search-box'
import { CartLink } from '@/components/cart/cart-link'
import { LogoMark } from '@/components/site/logo'
import { HeaderShell } from '@/components/site/header-shell'
import { MobileMenu } from '@/components/site/mobile-menu'
import { LanguageMenu } from '@/components/site/language-switcher'
import { FaceScan, User } from '@/components/icons'
import { navIcon } from '@/components/site/nav-icons'
import { whatsappLink } from '@/lib/whatsapp'

// G-02 to G-06. A mirrored header with the brand's emblem as its focal point.
// The emblem sits in the centre, large, in a cream medallion resting on the
// header's bottom line. Each side mirrors the other:
//
//   [Diagnóstico]   PRODUCTOS  NECESIDADES   (emblem)   MARCAS  JOURNAL   [⌕ ⚑ 👤 🛍]
//
// the links from the panel (navigation.menu) split evenly and gather towards
// the emblem; at the outer edges, the item marked "destacado" as a filled
// button on the left and search, account and cart (G-03) in an outlined
// capsule of the same width on the right, the language flag after search.
// On phones: menu + search | emblem | diagnosis + cart ("Mi cuenta" is in the menu).
// Equal side columns keep the emblem on the page's exact centre whatever the
// menu holds. On scroll the medallion shrinks into the bar.

const EDGE = 'lg:w-[12.25rem]' // the button and the capsule share it; the capsule's four icons just fit

function split(menu: LinkItem[]) {
  const regular = menu.filter((i) => !i.highlight)
  const half = Math.ceil(regular.length / 2)
  return { left: regular.slice(0, half), right: regular.slice(half), highlighted: menu.find((i) => i.highlight) }
}

/** A menu link: its icon over the label, in a pill that lights up on hover. Scrolled, the icon folds away. */
function NavLink({ item }: { item: LinkItem }) {
  const I = navIcon(item.href)
  return (
    <Link
      href={item.href}
      className="group/link flex flex-col items-center gap-1 whitespace-nowrap rounded-[1.1rem] px-3 py-2 text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-ink-soft transition-[background-color,color] duration-200 hover:bg-shell hover:text-ink xl:px-4 xl:text-[0.875rem]"
    >
      <I size={24} className="text-accent-ink transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/link:-translate-y-0.5 group-data-[scrolled=true]/header:hidden" />
      {item.label}
    </Link>
  )
}

function HighlightIcon({ href }: { href: string }) {
  const I = navIcon(href)
  return <I size={20} />
}

export async function SiteHeader() {
  const s = await getSettings()
  const menu = s['navigation.menu']
  const { left, right, highlighted } = split(menu)
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  const brand = s['brand.fullName']

  return (
    <HeaderShell>
      <div className="relative border-b border-line bg-paper/92 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
        {/* A thin terracotta rule under the bar. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />

        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 transition-[height] duration-300 lg:h-[6.5rem] lg:gap-6 group-data-[scrolled=true]/header:lg:h-[4.25rem]">
          {/* Left half: the highlighted button at the edge, links towards the emblem. */}
          <div className="flex min-w-0 items-center gap-1">
            <div className="flex items-center gap-1 lg:hidden">
              <MobileMenu items={menu} whatsapp={wa} mark={<LogoMark className="size-20" alt={brand} />} />
              <SearchBox placeholder={s['copy.searchPlaceholder']} compact />
            </div>
            {highlighted && (
              <Link
                href={highlighted.href}
                className={`hidden h-12 items-center justify-center gap-2 rounded-full bg-ink text-[0.8125rem] font-bold uppercase tracking-[0.06em] xl:tracking-[0.12em] text-paper shadow-[0_10px_24px_-10px_rgb(40_30_20/0.7)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-accent-ink lg:inline-flex xl:text-[0.875rem] ${EDGE}`}
              >
                <HighlightIcon href={highlighted.href} />
                {highlighted.label}
              </Link>
            )}
            <nav aria-label="Menú principal" className="ml-auto hidden items-center lg:flex">
              {left.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </div>

          {/* Centre: the emblem in its medallion. */}
          <Link href="/" aria-label={`${brand}, inicio`} className="group/logo relative z-10 grid place-items-center self-start rounded-full outline-offset-4 [perspective:40rem]">
            <span
              className={[
                // Layered: the paper medallion, a fine terracotta ring inside it, the emblem on top. It lifts and turns a little on hover.
                'grid place-items-center rounded-full bg-paper ring-1 ring-line',
                'shadow-[0_2px_4px_rgb(40_30_20/0.06),0_22px_40px_-18px_rgb(40_30_20/0.6),inset_0_0_0_4px_var(--color-paper),inset_0_0_0_5px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]',
                'transition-all duration-500 ease-[var(--ease-out-soft)] group-hover/logo:[transform:translateY(-2px)_rotateY(-12deg)_rotateX(6deg)]',
                // Mobile: 76 px medallion hanging 16 px under a 64 px bar.
                'mt-1 size-[4.75rem] p-1',
                // Desktop: 132 px medallion hanging 34 px under a 104 px bar.
                'lg:mt-1.5 lg:size-[8.25rem] lg:p-2',
                // Scrolled: it settles into the bar.
                'group-data-[scrolled=true]/header:mt-1.5 group-data-[scrolled=true]/header:size-[3.25rem] group-data-[scrolled=true]/header:p-0.5 group-data-[scrolled=true]/header:shadow-none group-data-[scrolled=true]/header:ring-0',
                'group-data-[scrolled=true]/header:lg:mt-1.5 group-data-[scrolled=true]/header:lg:size-[3.75rem]',
              ].join(' ')}
            >
              {/* The monogram is taller than wide; at 62% of the medallion its corners stay well inside the ring. */}
              <LogoMark className="size-[62%]" priority sizes="(min-width: 1024px) 82px, 48px" />
            </span>
          </Link>

          {/* Right half: links from the emblem outwards, then search + cart at the edge. */}
          <div className="flex min-w-0 items-center justify-end gap-1">
            <nav aria-label="Menú principal, continuación" className="mr-auto hidden items-center lg:flex">
              {right.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
            {highlighted && (
              <Link href={highlighted.href} aria-label={highlighted.label} className="grid size-10 place-items-center rounded-full text-ink hover:bg-shell lg:hidden">
                <FaceScan size={24} />
              </Link>
            )}
            <div className={`flex items-center justify-end lg:h-12 lg:justify-center lg:gap-1 lg:rounded-full lg:border lg:border-line-strong/80 lg:bg-paper/60 ${EDGE}`}>
              <span className="hidden lg:block">
                <SearchBox placeholder={s['copy.searchPlaceholder']} compact />
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-line-strong lg:block" />
              <LanguageMenu className="hidden lg:block" />
              <span className="flex items-center">
                <Link href="/cuenta" aria-label="Mi cuenta" className="hidden size-10 place-items-center rounded-full transition-colors hover:bg-shell lg:grid">
                  <User size={24} />
                </Link>
                <CartLink />
              </span>
            </div>
          </div>
        </div>
      </div>
    </HeaderShell>
  )
}
