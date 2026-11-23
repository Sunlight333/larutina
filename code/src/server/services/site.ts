import { cache } from 'react'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { fillVariables, type CopyVariables } from '@/lib/copy-variables'
import { formatARS } from '@/lib/money'

// Data shared by every storefront page: copy variables (GEN-06), the active
// announcements (NAV-01) and the published legal documents for the footer.

export const getCopyVariables = cache(async (): Promise<CopyVariables> => {
  const s = await getSettings()
  const db = getDb()
  const live = { status: { in: ['ACTIVE', 'PRESALE', 'SOLD_OUT'] as ('ACTIVE' | 'PRESALE' | 'SOLD_OUT')[] }, deletedAt: null }
  const [products, brands, routines] = await Promise.all([
    db.product.count({ where: live }),
    db.brand.count({ where: { deletedAt: null, products: { some: live } } }),
    db.routine.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
  ])
  const free = s['commerce.freeShippingFromCents']
  return {
    marca: s['brand.name'],
    productos: products,
    marcas: brands,
    rutinas: routines,
    preguntas: s['copy.diagnosisQuestions'],
    envio_gratis_desde: free > 0 ? formatARS(free) : '',
    descuento_transferencia: s['commerce.transferDiscountPct'],
  }
})

/** Fills copy variables in a panel text. */
export async function copy(text: string): Promise<string> {
  return fillVariables(text, await getCopyVariables())
}

export type ActiveAnnouncement = { id: string; text: string; href: string | null }

export const getAnnouncements = cache(async (): Promise<ActiveAnnouncement[]> => {
  const now = new Date()
  const rows = await getDb().announcement.findMany({
    where: { active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: { position: 'asc' },
  })
  const vars = await getCopyVariables()
  // A text that uses a variable with no value (no free-shipping threshold
  // yet, G-01) is not shown rather than shown half empty.
  return rows
    .filter((r) =>
      [...r.text.matchAll(/\{([a-z_]+)\}/g)].every((m) => {
        const v = vars[m[1]!]
        return v !== undefined && v !== '' && v !== 0
      }),
    )
    .map((r) => ({ id: r.id, text: fillVariables(r.text, vars), href: r.href }))
})

export type LegalLink = { code: string; title: string }

export const getLegalLinks = cache(async (): Promise<LegalLink[]> => {
  const docs = await getDb().legalDocument.findMany({ where: { versions: { some: {} } }, orderBy: { createdAt: 'asc' }, select: { code: true, title: true } })
  return docs
})
