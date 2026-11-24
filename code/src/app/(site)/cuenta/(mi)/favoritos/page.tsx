import { ArrowRight, Heart } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ProductCard } from '@/components/catalog/product-card'
import { AccountHeading, EmptyState } from '@/components/account/ui'
import { FavoriteButton } from '@/components/account/favorite-button'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { toCards } from '@/server/services/catalog/cards'
import { favoriteItems } from '@/server/customers/history'
import { requireCustomer } from '@/server/customers/web'

// CU-15: one list, the catalog's own cards, each with its heart to remove it.
export default async function FavoritesPage() {
  const customer = await requireCustomer('/cuenta/favoritos')
  const db = getDb()
  const items = await favoriteItems(db, customer.id, await getSettings())
  const cards = await toCards(items)
  const ids = new Map(items.map((p) => [p.code, p.id]))

  return (
    <>
      <AccountHeading icon={<Heart size={28} />} title="Favoritos" />
      {cards.length === 0 ? (
        <EmptyState
          icon={<Heart size={34} />}
          actions={
            <ButtonLink href="/productos" size="lg">
              Ver productos <ArrowRight size={18} />
            </ButtonLink>
          }
        >
          <p>Todavía no guardaste ningún producto. Tocá el corazón en los que te interesen y los vas a encontrar acá.</p>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6">
          {cards.map((p, i) => (
            <li key={p.code} data-reveal="up" style={{ '--i': i % 3 } as React.CSSProperties} className="relative">
              <ProductCard product={p} headingLevel="h2" sizes="(min-width: 1024px) 280px, (min-width: 640px) 31vw, 46vw" />
              <div className="absolute -right-1 -top-1 z-10">
                <FavoriteButton productId={ids.get(p.code)!} saved signedIn signInHref="/cuenta/ingresar" variant="round" refreshPage />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
