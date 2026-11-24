import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { getSettings } from '@/server/settings'
import { dataOf, readDraft, type DataValues } from '@/server/services/admin/catalog/product-fields'
import { completenessOf, loadProduct, publishProblems } from '@/server/services/admin/catalog/products'
import { AdminForm } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { param, type SearchParams } from '@/components/admin/table'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { saveDataAction } from '../actions'
import { StatusBadge } from '../badges'
import { DataFields } from '../data-fields'
import { ImagesSection, IngredientsSection, LinksSection, VariantsSection } from './sections'
import { CompletenessCard, DraftCard, StatusCard } from './side'

export const metadata = { title: 'Producto' }

const TABS = [
  ['datos', 'Datos'],
  ['variantes', 'Variantes'],
  ['ingredientes', 'Ingredientes'],
  ['necesidades', 'Necesidades y relaciones'],
  ['imagenes', 'Imágenes y video'],
] as const

export default async function ProductPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin('catalog.view')
  const [{ code }, sp] = await Promise.all([params, searchParams])
  const db = getDb()
  const product = await loadProduct(db, code)
  if (!product) notFound()
  const s = await getSettings()
  const canEdit = can(admin.role, 'catalog.edit')
  const tab = TABS.find(([t]) => t === param(sp, 's'))?.[0] ?? 'datos'
  const draft = readDraft(product.draft)
  const columns = dataOf(product)
  const values: DataValues = { ...columns, ...(draft ?? {}) }

  const [brands, categories, baseFromDraft, problems] = await Promise.all([
    db.brand.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, parent: { select: { name: true } } } }),
    draft?.baseProductId ? db.product.findUnique({ where: { id: String(draft.baseProductId) }, select: { code: true } }) : null,
    product.status === 'DRAFT' ? publishProblems(db, product.id) : Promise.resolve([]),
  ])
  const baseProductCode = draft && 'baseProductId' in draft ? (baseFromDraft?.code ?? null) : (product.baseProduct?.code ?? null)

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{product.code}</span>
            <StatusBadge status={product.status} />
          </span>
        }
        back={{ href: '/productos', label: 'Productos' }}
      />
      {sp.creado !== undefined && (
        <div className="mb-4">
          <Notice tone="success" title="Producto creado en Borrador">
            Completá variantes, ingredientes, necesidades e imágenes; cuando esté listo, publicalo.
          </Notice>
        </div>
      )}
      {!canEdit && (
        <div className="mb-4">
          <Notice tone="info">Tu rol puede ver el catálogo pero no editarlo.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0 space-y-4">
          <nav aria-label="Secciones del producto" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map(([t, label]) => (
              <Link
                key={t}
                href={`/productos/${product.code}${t === 'datos' ? '' : `?s=${t}`}`}
                aria-current={t === tab ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${t === tab ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
            {tab === 'datos' && (
              <Card
                description={
                  product.status === 'DRAFT'
                    ? 'El producto está en Borrador: lo que guardes se aplica directo.'
                    : 'El producto está publicado: lo que guardes queda como cambios sin publicar hasta que los publiques.'
                }
              >
                <AdminForm action={saveDataAction.bind(null, product.code)} submitLabel={product.status === 'DRAFT' ? 'Guardar' : 'Guardar cambios sin publicar'}>
                  <KeepInput />
                  <DataFields
                    values={values}
                    brands={brands.map((b) => ({ value: b.id, label: b.name }))}
                    categories={categories.map((c) => ({ value: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }))}
                    baseProductCode={baseProductCode}
                    dermatologistLabelEnabled={s['catalog.dermatologistLabelEnabled']}
                  />
                </AdminForm>
              </Card>
            )}
            {tab === 'variantes' && <VariantsSection product={product} canCost={can(admin.role, 'catalog.cost')} />}
            {tab === 'ingredientes' && <IngredientsSection product={product} />}
            {tab === 'necesidades' && <LinksSection product={product} />}
            {tab === 'imagenes' && <ImagesSection product={product} />}
          </fieldset>
        </div>
        <aside className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            {draft && <DraftCard code={product.code} draft={draft} columns={columns} />}
            <StatusCard code={product.code} status={product.status} publishedAt={product.publishedAt} problems={problems} hasPresaleDate={!!values.presaleDate} />
          </fieldset>
          <CompletenessCard completeness={completenessOf(product)} />
        </aside>
      </div>
    </>
  )
}
