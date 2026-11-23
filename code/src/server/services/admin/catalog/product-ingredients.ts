// A product's ingredients from the panel (CAT-08, CAT-19): the INCI text is
// split and matched exactly as the import does (catalog-import/ingredient-list),
// unknown names become ingredients to review, and the family flags are
// recomputed. Applies at once: the list and the flags are relational and
// must always match the INCI the site shows.
import { audit } from '@/server/audit'
import { buildIngredientList, computeFlags, fragranceMismatch, inciMatcher, type ProductFlags } from '@/server/catalog-import/ingredient-list'
import { fail, ok, type Actor, type Db, type Result, type Tx } from './common'

export type StarInput = { code: string; isStar: boolean; concentration: string | null }

type IngredientRow = { id: string; code: string; inciKey: string; status: string; deletedAt: Date | null; family: { code: string; computes: string[] } | null }

const flagsOf = (p: ProductFlags) => ({ ...p })

async function ingredientIndex(db: Db | Tx) {
  const all: IngredientRow[] = await db.ingredient.findMany({
    select: { id: true, code: true, inciKey: true, status: true, deletedAt: true, family: { select: { code: true, computes: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  // Same INCI name twice: a live, reviewed ingredient wins over one in the
  // trash or still to review.
  const rank = (i: IngredientRow) => (i.deletedAt ? 0 : i.status === 'REVIEW' ? 1 : 2)
  const byInci = new Map<string, string>()
  for (const i of [...all].sort((a, b) => rank(a) - rank(b))) byInci.set(i.inciKey, i.code)
  return { all, byCode: new Map(all.map((i) => [i.code, i])), byInci }
}

/**
 * Saves the INCI text and the star ingredients. With INCI text, rows that are
 * neither star nor with a concentration are not kept apart from the text;
 * a star ingredient missing from the text is added at the end, as the
 * import does.
 */
export async function saveProductIngredients(db: Db, actor: Actor, code: string, input: { inciText: string; stars: StarInput[] }): Promise<Result> {
  const product = await db.product.findFirst({
    where: { code, deletedAt: null },
    include: { ingredients: { orderBy: { inciOrder: 'asc' }, include: { ingredient: { select: { code: true } } } } },
  })
  if (!product) return fail('El producto no existe.')
  const inciText = input.inciText.replace(/\s+/g, ' ').trim() || null
  const index = await ingredientIndex(db)

  const unknown = input.stars.filter((s) => !index.byCode.has(s.code)).map((s) => s.code)
  if (unknown.length) return fail(`Estos ingredientes no existen: ${unknown.join(', ')}.`, { stars: 'Revisá los códigos.' })
  const highlights = input.stars
    .filter((s) => !inciText || s.isStar || s.concentration)
    .map((s, i) => ({ ...s, inciOrder: i + 1, source: s }))

  const warnings: string[] = []
  const matcher = inciMatcher(index.byInci, new Set(index.all.map((i) => i.code)))
  const list = buildIngredientList(inciText, highlights, matcher.match, (issue) => {
    if (issue.kind === 'repeated-in-inci') warnings.push(`"${issue.name}" aparece dos veces en la lista INCI; se toma la primera posición.`)
    else if (issue.kind === 'not-in-inci') warnings.push(`"${issue.item.code}" no figura en la lista INCI; se agrega al final.`)
    else warnings.push(`"${issue.item.code}" está dos veces; se toma una.`)
  })

  const created = [...matcher.created.values()]
  const familyOf = (c: string) => index.byCode.get(c)?.family?.code
  const computes = new Map(index.all.filter((i) => i.family).map((i) => [i.family!.code, i.family!.computes]))
  const flags = computeFlags(
    list.map((i) => i.code),
    familyOf,
    (f) => computes.get(f),
  )
  const mismatch = fragranceMismatch(product.fragranceFreeDeclared, flags.fragranceFree)
  if (mismatch) warnings.push(mismatch)

  const before = {
    inciText: product.inciText,
    ingredients: product.ingredients.map((i) => ({ code: i.ingredient.code, inciOrder: i.inciOrder, isStar: i.isStar, concentration: i.concentration })),
    flags: flagsOf({
      fragranceFree: product.fragranceFree,
      essentialOilFree: product.essentialOilFree,
      containsRetinoid: product.containsRetinoid,
      containsExfoliatingAcid: product.containsExfoliatingAcid,
      alcoholFree: product.alcoholFree,
      parabenFree: product.parabenFree,
      siliconeFree: product.siliconeFree,
      sulfateFree: product.sulfateFree,
    }),
  }
  const after = { inciText, ingredients: list, flags }
  if (JSON.stringify(before) === JSON.stringify(after)) return ok('No había cambios.')

  await db.$transaction(async (tx) => {
    for (const ing of created) {
      const row = await tx.ingredient.create({ data: { ...ing, status: 'REVIEW' } })
      await audit(tx, actor, { action: 'create', entityType: 'Ingredient', entityId: row.id, label: `${ing.inciName} (desde la lista INCI de ${product.code})`, after: { ...ing, status: 'REVIEW' } })
    }
    const ids = new Map((await tx.ingredient.findMany({ where: { code: { in: list.map((i) => i.code) } }, select: { id: true, code: true } })).map((i) => [i.code, i.id]))
    await tx.productIngredient.deleteMany({ where: { productId: product.id } })
    await tx.productIngredient.createMany({
      data: list.map((i) => ({ productId: product.id, ingredientId: ids.get(i.code)!, inciOrder: i.inciOrder, isStar: i.isStar, concentration: i.concentration })),
    })
    await tx.product.update({ where: { id: product.id }, data: { inciText, ...flags } })
    await audit(tx, actor, { action: 'ingredients.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before, after })
  })

  const parts = [`Ingredientes guardados: ${list.length}.`]
  if (created.length) parts.push(`Nuevos para revisar: ${created.map((c) => c.inciName).join(', ')}.`)
  return ok([...parts, ...warnings].join(' '))
}

/**
 * Recomputes the family flags of the products that contain any of these
 * ingredients, after an ingredient's family changes (CAT-08: computed on
 * every import or edit).
 */
export async function recomputeFlagsForIngredients(tx: Tx, ingredientIds: string[]): Promise<number> {
  const products = await tx.product.findMany({
    where: { ingredients: { some: { ingredientId: { in: ingredientIds } } } },
    select: { id: true, ingredients: { select: { ingredient: { select: { code: true, family: { select: { code: true, computes: true } } } } } } },
  })
  for (const p of products) {
    const fam = new Map(p.ingredients.map((i) => [i.ingredient.code, i.ingredient.family]))
    const flags = computeFlags(
      fam.keys(),
      (c) => fam.get(c)?.code,
      (f) => [...fam.values()].find((x) => x?.code === f)?.computes,
    )
    await tx.product.update({ where: { id: p.id }, data: flags })
  }
  return products.length
}
