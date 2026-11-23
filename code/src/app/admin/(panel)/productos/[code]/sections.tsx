import Link from 'next/link'
import { getDb } from '@/server/db'
import { LISTS } from '@/server/catalog-import/lists'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, PRODUCT_IMAGE_MIN } from '@/server/media'
import { imageAssets } from '@/server/services/admin/catalog/product-images'
import { RELATION_KINDS } from '@/server/services/admin/catalog/product-links'
import type { loadProduct } from '@/server/services/admin/catalog/products'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { KeepInput } from '@/components/admin/keep-input'
import { Checkbox, LinesField, MoneyField, Select, TextArea, TextField } from '@/components/admin/fields'
import { Badge, Card, EmptyState } from '@/components/admin/ui'
import { addImagesAction, concernsAction, createVariantAction, imageAction, ingredientsAction, relationsAction, skinTypesAction, updateVariantAction, videoAction } from '../actions'

type Product = NonNullable<Awaited<ReturnType<typeof loadProduct>>>

const UNIT_OPTIONS = LISTS.unidad.labels.map(([label, value]) => ({ value, label }))
const num = (v: unknown) => (v === null || v === undefined ? '' : String(Number(v)))
const cell = 'h-9 w-full rounded-lg border border-line-strong bg-paper px-2 text-sm'

// -------------------------------------------------------------- variants ----

function VariantFields({ v, canCost }: { v?: Product['variants'][number]; canCost: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TextField name="size" label="Tamaño" defaultValue={num(v?.size)} required />
      <Select name="unit" label="Unidad" options={UNIT_OPTIONS} defaultValue={v?.unit ?? 'ML'} />
      <TextField name="stock" label="Stock" defaultValue={v?.stock ?? ''} required />
      <MoneyField name="priceCents" label="Precio" defaultCents={v?.priceCents} required />
      <MoneyField name="promoPriceCents" label="Precio promocional" defaultCents={v?.promoPriceCents} help="Menor al precio. Vacío: sin promoción." />
      {canCost && <MoneyField name="costCents" label="Costo" defaultCents={v?.costCents} help="Solo lo ve Administración." />}
      <TextField name="durationDays" label="Duración (días)" defaultValue={v?.durationDays ?? ''} help="Vacío: la del producto." />
      <TextField name="weightGrams" label="Peso (g)" defaultValue={v?.weightGrams ?? ''} />
      <TextField name="barcode" label="Código de barras" defaultValue={v?.barcode ?? ''} />
      <TextField name="heightCm" label="Alto (cm)" defaultValue={num(v?.heightCm)} />
      <TextField name="widthCm" label="Ancho (cm)" defaultValue={num(v?.widthCm)} />
      <TextField name="lengthCm" label="Largo (cm)" defaultValue={num(v?.lengthCm)} />
      <div className="sm:col-span-3">
        <Checkbox name="isMain" label="Variante principal" defaultChecked={v ? v.isMain : false} help="Una por producto: marcar esta desmarca la anterior." />
      </div>
    </div>
  )
}

export function VariantsSection({ product, canCost }: { product: Product; canCost: boolean }) {
  return (
    <div className="space-y-4">
      {product.variants.map((v) => (
        <Card key={v.sku} title={v.sku} actions={v.isMain ? <Badge tone="success">Principal</Badge> : undefined} description="El SKU no se cambia: es la clave de pedidos, kits y planillas.">
          <AdminForm
            action={updateVariantAction.bind(null, product.code, v.sku)}
            extraButtons={
              <SubmitButton name="op" value="borrar" variant="ghost" confirm={`¿Borrar la variante ${v.sku}?`}>
                Borrar variante
              </SubmitButton>
            }
          >
            <KeepInput />
            <VariantFields v={v} canCost={canCost} />
          </AdminForm>
        </Card>
      ))}
      <Card title="Nueva variante">
        <AdminForm action={createVariantAction.bind(null, product.code)} submitLabel="Agregar variante" resetOnSuccess>
          <KeepInput />
          <TextField name="sku" label="SKU" required help="Letras, números, puntos y guiones. No se puede cambiar después." />
          <VariantFields canCost={canCost} />
        </AdminForm>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------- ingredients ----

const FLAG_LABELS: [keyof Product, string][] = [
  ['fragranceFree', 'Sin fragancia'],
  ['essentialOilFree', 'Sin aceites esenciales'],
  ['alcoholFree', 'Sin alcohol secante'],
  ['parabenFree', 'Sin parabenos'],
  ['siliconeFree', 'Sin siliconas'],
  ['sulfateFree', 'Sin sulfatos'],
  ['containsRetinoid', 'Contiene retinoide'],
  ['containsExfoliatingAcid', 'Contiene ácido exfoliante'],
]

export function IngredientsSection({ product }: { product: Product }) {
  return (
    <Card
      title="Ingredientes"
      description="Al guardar, la lista INCI se separa respetando paréntesis, se asocia a los ingredientes existentes y los nombres nuevos quedan para revisar, igual que en la importación. Los indicadores se calculan con las familias."
    >
      <AdminForm action={ingredientsAction.bind(null, product.code)} submitLabel="Guardar ingredientes">
        <KeepInput />
        <TextArea name="inciText" label="Lista INCI" defaultValue={product.inciText} rows={5} help="Como figura en el envase, separada por comas." />
        {product.ingredients.length ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-shell/60 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ingrediente</th>
                  <th scope="col" className="px-3 py-2 font-medium">Familia</th>
                  <th scope="col" className="px-3 py-2 font-medium">Estrella</th>
                  <th scope="col" className="px-3 py-2 font-medium">Concentración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {product.ingredients.map((pi) => (
                  <tr key={pi.ingredientId}>
                    <td className="px-3 py-1.5 tabular-nums text-ink-muted">{pi.inciOrder}</td>
                    <td className="px-3 py-1.5">
                      <input type="hidden" name="codes" value={pi.ingredient.code} />
                      <Link href={`/admin/ingredientes/${pi.ingredient.code}`} className="underline-offset-2 hover:underline">
                        {pi.ingredient.commonName}
                      </Link>
                      {pi.ingredient.commonName !== pi.ingredient.inciName && <span className="text-xs text-ink-muted"> · {pi.ingredient.inciName}</span>}
                      {pi.ingredient.status === 'REVIEW' && (
                        <span className="ml-2">
                          <Badge tone="warning">Revisar</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-ink-muted">{pi.ingredient.family?.name ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" name={`star.${pi.ingredient.code}`} defaultChecked={pi.isStar} aria-label={`${pi.ingredient.commonName}: ingrediente estrella`} className="size-4 accent-ink" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input name={`conc.${pi.ingredient.code}`} defaultValue={pi.concentration ?? ''} aria-label={`${pi.ingredient.commonName}: concentración`} className={`${cell} w-24`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Sin ingredientes todavía: cargá la lista INCI y guardá.</EmptyState>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField name="extra" label="Agregar un ingrediente estrella fuera de la lista" placeholder="codigo-del-ingrediente" help="Por código. Con lista INCI, se agrega al final." />
          <TextField name="extraConc" label="Concentración" />
        </div>
        <div>
          <p className="text-sm font-medium">Indicadores calculados</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {FLAG_LABELS.map(([k, label]) => (
              <Badge key={k} tone={product[k] ? (k.startsWith('contains') ? 'warning' : 'success') : 'neutral'}>
                {k.startsWith('contains') ? label : product[k] ? label : label.replace('Sin', 'Con')}
              </Badge>
            ))}
          </div>
          {product.fragranceFreeDeclared !== null && product.fragranceFreeDeclared !== product.fragranceFree && (
            <p className="mt-2 text-xs text-accent-ink">Lo cargado en la planilla ("sin fragancia": {product.fragranceFreeDeclared ? 'Sí' : 'No'}) no coincide con el INCI: se publica lo calculado.</p>
          )}
        </div>
      </AdminForm>
    </Card>
  )
}

// ----------------------------------------------------------------- links ----

export async function LinksSection({ product }: { product: Product }) {
  const db = getDb()
  const [concerns, skinTypes] = await Promise.all([
    db.concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    db.skinType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
  ])
  const relevance = new Map(product.concerns.map((c) => [c.concernId, c.relevance]))
  const aptitude = new Map(product.skinTypes.map((s) => [s.skinTypeId, s.aptitude]))
  return (
    <div className="space-y-4">
      <Card title="Necesidades" description="Relevancia de 0 a 100. Vacío: el producto no trata esa necesidad.">
        <AdminForm action={concernsAction.bind(null, product.code)} submitLabel="Guardar necesidades">
          <KeepInput />
          <div className="grid gap-4 sm:grid-cols-2">
            {concerns.map((c) => (
              <div key={c.id}>
                <input type="hidden" name="concernIds" value={c.id} />
                <TextField name={`relevance.${c.id}`} label={c.name} defaultValue={relevance.get(c.id) ?? ''} placeholder="0 a 100" />
              </div>
            ))}
          </div>
        </AdminForm>
      </Card>
      <Card title="Tipos de piel" description="Aptitud para cada tipo. Sin elegir: no se indica.">
        <AdminForm action={skinTypesAction.bind(null, product.code)} submitLabel="Guardar tipos de piel">
          <KeepInput />
          <div className="grid gap-4 sm:grid-cols-2">
            {skinTypes.map((s) => (
              <div key={s.id}>
                <input type="hidden" name="skinTypeIds" value={s.id} />
                <Select name={`aptitude.${s.id}`} label={s.name} defaultValue={aptitude.get(s.id) ?? ''} allowEmpty="—" options={LISTS.aptitud.labels.map(([label, value]) => ({ value, label }))} />
              </div>
            ))}
          </div>
        </AdminForm>
      </Card>
      <Card title="Productos relacionados" description="Un código de producto por línea, en el orden en que se muestran.">
        <AdminForm action={relationsAction.bind(null, product.code)} submitLabel="Guardar relaciones">
          <KeepInput />
          {RELATION_KINDS.map(({ kind, label, help }) => {
            const rel = product.relations.filter((r) => r.kind === kind)
            return (
              <LinesField
                key={kind}
                name={kind}
                label={label}
                rows={3}
                defaultValues={rel.map((r) => r.related.code)}
                help={rel.length ? `${help} Ahora: ${rel.map((r) => r.related.name).join(', ')}.` : help}
              />
            )
          })}
        </AdminForm>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- images ----

export async function ImagesSection({ product }: { product: Product }) {
  const images = await imageAssets(getDb(), product.images)
  return (
    <div className="space-y-4">
      <Card title="Imágenes" description={`La primera es la principal. Fotos 4:5 de ${PRODUCT_IMAGE_MIN.width} × ${PRODUCT_IMAGE_MIN.height} px o más; el sitio genera los tamaños livianos.`}>
        {images.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((img, i) => (
              <li key={`${img.ref}-${i}`} className="rounded-lg border border-line p-3">
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" className="aspect-[4/5] w-full rounded-md bg-shell object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center rounded-md border border-dashed border-line-strong p-3 text-center text-xs text-ink-muted">Archivo no subido todavía</div>
                )}
                <p className="mt-2 truncate text-xs text-ink-muted" title={img.ref}>
                  {i === 0 && <Badge tone="success">Principal</Badge>} {img.asset ? `${img.asset.fileName} · ${img.asset.width ?? '?'} × ${img.asset.height ?? '?'}` : img.ref}
                </p>
                {img.warnings.map((w) => (
                  <p key={w} className="mt-1 text-xs text-accent-ink">
                    {w}
                  </p>
                ))}
                <AdminForm action={imageAction.bind(null, product.code)} submitLabel={null} className="mt-2 space-y-2">
                  <input type="hidden" name="index" value={i} />
                  <div className="flex flex-wrap gap-1">
                    {i > 0 && (
                      <SubmitButton name="op" value="subir" variant="ghost">
                        ← Antes
                      </SubmitButton>
                    )}
                    {i < images.length - 1 && (
                      <SubmitButton name="op" value="bajar" variant="ghost">
                        Después →
                      </SubmitButton>
                    )}
                    {i > 0 && (
                      <SubmitButton name="op" value="principal" variant="ghost">
                        Principal
                      </SubmitButton>
                    )}
                    <SubmitButton name="op" value="quitar" variant="ghost" confirm="¿Quitar esta imagen del producto?">
                      Quitar
                    </SubmitButton>
                  </div>
                </AdminForm>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Sin imágenes. Un producto necesita al menos una para publicarse.</EmptyState>
        )}
        <AdminForm action={addImagesAction.bind(null, product.code)} submitLabel="Subir imágenes" className="mt-5 space-y-3" resetOnSuccess>
          <UploadInput name="images" label="Agregar imágenes" accept="image/jpeg,image/png,image/webp,image/avif" multiple help={`JPG, PNG, WebP o AVIF, hasta ${MAX_IMAGE_BYTES / 1024 / 1024} MB cada una. Se pueden elegir varias.`} />
        </AdminForm>
      </Card>
      <Card title="Video" description="Un MP4 de hasta 30 segundos, o un link de YouTube o Vimeo.">
        <AdminForm action={videoAction.bind(null, product.code)} submitLabel="Guardar video" resetOnSuccess>
          {product.videoUrl && (
            <p className="text-sm">
              Ahora:{' '}
              <a href={product.videoUrl} target="_blank" rel="noopener" className="underline">
                {product.videoUrl}
              </a>
            </p>
          )}
          <TextField name="videoUrl" label="Link del video" type="url" defaultValue={product.videoUrl ?? ''} placeholder="https://www.youtube.com/…" />
          <UploadInput name="videoFile" label="O subí un MP4" accept="video/mp4" help={`Hasta ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Reemplaza el link.`} />
          {product.videoUrl && <Checkbox name="removeVideo" label="Quitar el video" />}
        </AdminForm>
      </Card>
    </div>
  )
}

function UploadInput({ name, label, accept, multiple, help }: { name: string; label: string; accept: string; multiple?: boolean; help: string }) {
  const id = `upload-${name}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input id={id} name={name} type="file" accept={accept} multiple={multiple} aria-describedby={`${id}-help`} className="block text-sm" />
      <p id={`${id}-help`} className="text-xs text-ink-muted">
        {help}
      </p>
    </div>
  )
}
