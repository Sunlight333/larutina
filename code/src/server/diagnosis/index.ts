// The diagnosis on the server (DIA-01..DIA-12): the current rule set, the
// catalog as the engine sees it, running and saving, the simulator,
// publishing a new version, the routine by email and attaching a diagnosis
// to an account.
import { randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { isEmail } from '@/lib/argentina'
import { formatARS } from '@/lib/money'
import { DEFAULT_RULESET, type RuleSet } from '@/lib/diagnosis/ruleset'
import { runDiagnosis, validateAnswers, type Answer, type DiagnosisResult, type EngineCatalog } from '@/lib/diagnosis/run'
import { chargedCents, publishedProductWhere, variantAvailable } from '@/server/services/catalog/rules'
import { STEP_LABELS } from '@/server/services/catalog/labels'
import { enqueueEmail } from '@/server/email'
import { loadSettings } from '@/server/settings'
import { checkCoupon } from '@/server/commerce/coupons'

type Db = PrismaClient | Prisma.TransactionClient

/** The published rule set with the highest version; version 1 (the content file's) is created on first use. */
export async function currentRuleSet(db: PrismaClient): Promise<RuleSet> {
  const row = await db.diagnosisRuleSet.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' } })
  if (row) return { ...(row.definition as unknown as RuleSet), version: row.version }
  await db.diagnosisRuleSet.createMany({ data: [{ version: DEFAULT_RULESET.version, status: 'PUBLISHED', definition: DEFAULT_RULESET as unknown as Prisma.InputJsonValue, note: 'Versión inicial: preguntas del archivo de contenidos', publishedAt: new Date() }], skipDuplicates: true })
  return DEFAULT_RULESET
}

export async function ruleSetVersion(db: PrismaClient, version: number): Promise<RuleSet | null> {
  if (version === DEFAULT_RULESET.version && !(await db.diagnosisRuleSet.count({ where: { version } }))) return DEFAULT_RULESET
  const row = await db.diagnosisRuleSet.findUnique({ where: { version } })
  return row ? { ...(row.definition as unknown as RuleSet), version: row.version } : null
}

/** The published catalog as the engine sees it. */
export async function engineCatalog(db: Db): Promise<EngineCatalog> {
  const [products, families, ingConflicts, famConflicts, concerns] = await Promise.all([
    db.product.findMany({
      where: publishedProductWhere(),
      include: {
        brand: { select: { name: true } },
        variants: { orderBy: [{ isMain: 'desc' }, { priceCents: 'asc' }] },
        skinTypes: { include: { skinType: { select: { code: true } } } },
        concerns: { include: { concern: { select: { code: true } } } },
        ingredients: { include: { ingredient: { select: { id: true, commonName: true, isKeyActive: true, isIrritant: true, family: { select: { code: true } } } } } },
      },
    }),
    db.ingredientFamily.findMany({ select: { id: true, code: true, noDuplicate: true } }),
    db.ingredientConflict.findMany(),
    db.familyConflict.findMany(),
    db.concern.findMany({ where: { deletedAt: null }, select: { code: true, name: true } }),
  ])
  const famCode = new Map(families.map((f) => [f.id, f.code]))
  return {
    products: products.map((p) => {
      const main = p.variants[0]
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand.name,
        type: p.type,
        stepType: p.routineStep,
        moment: p.moment,
        level: p.level,
        priority: p.priority,
        chargedCents: main ? chargedCents(main) : 0,
        inStock: p.variants.some((v) => variantAvailable(p.status, v.stock)),
        aptitude: Object.fromEntries(p.skinTypes.map((s) => [s.skinType.code, s.aptitude])),
        relevance: Object.fromEntries(p.concerns.map((c) => [c.concern.code, c.relevance])),
        ingredients: p.ingredients.map((pi) => ({ id: pi.ingredient.id, name: pi.ingredient.commonName, keyActive: pi.isStar || pi.ingredient.isKeyActive, irritant: pi.ingredient.isIrritant, family: pi.ingredient.family?.code ?? null })),
      }
    }),
    families: families.map((f) => ({ code: f.code, noDuplicate: f.noDuplicate })),
    conflicts: [
      ...ingConflicts.map((c) => ({ kind: 'ingredient' as const, a: c.ingredientAId, b: c.ingredientBId, severity: c.severity, note: c.note })),
      ...famConflicts.map((c) => ({ kind: 'family' as const, a: famCode.get(c.familyAId) ?? '', b: famCode.get(c.familyBId) ?? '', severity: c.severity, note: c.note })),
    ],
    concernNames: Object.fromEntries(concerns.map((c) => [c.code, c.name])),
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => [...randomBytes(8)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

/** What is stored of a result: nothing that reveals a session-only answer (DIA-07). */
export function storable(rs: RuleSet, answers: Answer[], result: DiagnosisResult) {
  const privateKeys = new Set(rs.questions.filter((q) => q.sessionOnly).map((q) => q.key))
  const privateNotes = new Set(Object.values(rs.texts.excluded))
  return {
    answers: answers.filter((a) => !privateKeys.has(a.questionKey)),
    interpretation: { ...result.interpretation, excluded: [] },
    result: { ...result, interpretation: { ...result.interpretation, excluded: [] }, notes: result.notes.filter((n) => !privateNotes.has(n)) },
  }
}

/** Runs the current rule set on her answers and keeps the result (DIA-12: never overwrites an earlier one). */
export async function diagnoseAndSave(db: PrismaClient, answers: Answer[], opts: { customerId?: string | null } = {}) {
  const rs = await currentRuleSet(db)
  const valid = validateAnswers(rs, answers)
  const result = runDiagnosis(rs, valid, await engineCatalog(db))
  const kept = storable(rs, valid, result)
  const row = await db.diagnosis.create({
    data: {
      code: newCode(),
      ruleVersion: rs.version,
      answers: kept.answers as unknown as Prisma.InputJsonValue,
      signals: result.signals as unknown as Prisma.InputJsonValue,
      interpretation: kept.interpretation as unknown as Prisma.InputJsonValue,
      result: kept.result as unknown as Prisma.InputJsonValue,
      customerId: opts.customerId ?? null,
    },
  })
  // The full result is returned once, for the page she is about to see; only the stored one is kept.
  return { code: row.code, result }
}

/** DIA-04: what a rule set (draft or published) would give for these answers, and why. */
export async function simulate(db: PrismaClient, rs: RuleSet, answers: Answer[]) {
  const catalog = await engineCatalog(db)
  const result = runDiagnosis(rs, answers, catalog)
  return { result, catalog }
}

/** DIA-03: a new version, published; the previous ones stay for reproduction. */
export async function publishRuleSet(db: PrismaClient, definition: RuleSet, actorEmail: string, note: string) {
  await currentRuleSet(db)
  const last = await db.diagnosisRuleSet.aggregate({ _max: { version: true } })
  const version = (last._max.version ?? 0) + 1
  await db.diagnosisRuleSet.create({ data: { version, status: 'PUBLISHED', definition: { ...definition, version } as unknown as Prisma.InputJsonValue, note: note || null, createdBy: actorEmail, publishedAt: new Date() } })
  return version
}

/** DIA-12, R-20: a diagnosis made before signing up joins the account. */
export async function attachDiagnosis(db: PrismaClient, code: string, customerId: string) {
  await db.diagnosis.updateMany({ where: { code, customerId: null }, data: { customerId } })
}

/** EM-13, R-21: her routine by email, with the first-purchase coupon when one is set (DIA-10). Newsletter only with its own box. */
export async function emailRoutine(db: PrismaClient, code: string, rawEmail: string, newsletter: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = rawEmail.trim().toLowerCase()
  if (!isEmail(email)) return { ok: false, error: 'Ingresá un email válido.' }
  const d = await db.diagnosis.findUnique({ where: { code } })
  if (!d) return { ok: false, error: 'No encontramos ese resultado.' }
  const s = await loadSettings(db)
  const result = d.result as unknown as DiagnosisResult
  const ids = result.steps.map((x) => x.productId).filter((x): x is string => !!x)
  const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, brand: { select: { name: true } }, variants: { where: { isMain: true }, select: { priceCents: true, promoPriceCents: true } } } })
  const byId = new Map(products.map((p) => [p.id, p]))
  const block = (slot: 'AM' | 'PM', title: string) => {
    const rows = result.steps.filter((x) => x.slot === slot)
    if (!rows.length) return ''
    return `**${title}**\n\n${rows
      .map((x, i) => {
        const p = x.productId ? byId.get(x.productId) : null
        if (!p) return `${i + 1}. ${STEP_LABELS[x.stepType]}: Sin stock por ahora`
        const price = p.variants[0] ? ` · ${formatARS(chargedCents(p.variants[0]))}` : ''
        return `${i + 1}. ${STEP_LABELS[x.stepType]}: ${p.brand.name} ${p.name}${price}${x.because ? `. ${x.because}` : ''}${x.frequency ? ` (${x.frequency})` : ''}`
      })
      .join('\n')}`
  }
  let coupon = ''
  if (s['diagnosis.firstPurchaseCoupon']) {
    const c = await checkCoupon(db, s['diagnosis.firstPurchaseCoupon'], { subtotalCents: Number.MAX_SAFE_INTEGER, email })
    if (c.ok) coupon = `Para tu primera compra, usá el código **${c.coupon.code}**.`
  }
  await db.$transaction(async (tx) => {
    await tx.diagnosis.update({ where: { id: d.id }, data: { email, emailedAt: new Date() } })
    await enqueueEmail(tx, { template: 'routine_email', to: email, vars: { rutina: [block('AM', 'De mañana'), block('PM', 'De noche')].filter(Boolean).join('\n\n'), cupon: coupon }, ctaPath: `/diagnostico/resultado/${d.code}`, related: { type: 'diagnosis', id: d.id } }, s)
    if (newsletter) await tx.newsletterSubscriber.upsert({ where: { email }, create: { email, consentText: 'Quiero recibir el newsletter', source: 'diagnostico' }, update: { unsubscribedAt: null } })
  })
  return { ok: true }
}
