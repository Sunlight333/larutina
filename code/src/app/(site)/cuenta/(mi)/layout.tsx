import type { Metadata } from 'next'
import { AccountNav } from '@/components/account/account-nav'
import { currentCustomer } from '@/server/customers/session'
import { getSettings } from '@/server/settings'

// CU-21: every signed-in screen is titled "Mi [marca]".
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Mi ${(await getSettings())['brand.name']}` }
}

// Mi Larutina (CU-06 to CU-18): the accesses beside every screen. Each page
// checks the session itself and sends her to "Ingresar" with the way back.
export default async function MyAccountLayout({ children }: { children: React.ReactNode }) {
  const [customer, s] = await Promise.all([currentCustomer(), getSettings()])
  if (!customer) return children
  return (
    <div className="tex-grain">
      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-8 pb-16 pt-6 md:pb-24 md:pt-10 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-14">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <div className="lg:tex-linen lg:rounded-[1.5rem_2.75rem_1.5rem_2.75rem] lg:bg-shell lg:p-3 lg:shadow-[var(--shadow-soft)] lg:ring-1 lg:ring-line/70">
            <AccountNav home={`Mi ${s['brand.name']}`} />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
