// One listing page: the catalog, filtered, counted, sorted and paged, with
// its cards. Used by /productos, the taxonomy pages and /buscar.
import { getCatalog } from './catalog'
import { toCards, type ProductCardData } from './cards'
import { runListing, type ListingResult, type ListingScope } from './listing'
import type { ListingState } from './listing-params'
import { getListingSettings, getListingTaxonomy } from './taxonomy'

export type BrowseResult = ListingResult & { cards: ProductCardData[]; pageSize: number }

export async function browse(state: ListingState, scope: ListingScope = {}): Promise<BrowseResult> {
  const [catalog, taxonomy, settings] = await Promise.all([getCatalog(), getListingTaxonomy(), getListingSettings()])
  const result = runListing(catalog, state, taxonomy, settings, scope)
  return { ...result, cards: await toCards(result.items), pageSize: settings.pageSize }
}
