'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { getSettings } from '@/server/settings'
import { bool, files, str, type FormState } from '@/server/admin/forms'
import { DATA_FIELDS, type DataInput } from '@/server/services/admin/catalog/product-fields'
import { bulkSetStatus, createProduct, deleteProduct, discardDraft, publishDraft, publishProduct, saveProductData, setProductStatus } from '@/server/services/admin/catalog/products'
import { createVariant, deleteVariant, updateVariant, type VariantInput } from '@/server/services/admin/catalog/variants'
import { saveProductIngredients, type StarInput } from '@/server/services/admin/catalog/product-ingredients'
import { RELATION_KINDS, saveProductConcerns, saveProductRelations, saveProductSkinTypes } from '@/server/services/admin/catalog/product-links'
import { addProductImages, changeProductImage, saveProductVideo } from '@/server/services/admin/catalog/product-images'

// Form → service → FormState. The rules live in services/admin/catalog.

const touched = (code?: string) => {
  revalidatePath('/admin/productos')
  if (code) revalidatePath(`/admin/productos/${code}`)
  // The storefront reads the catalog; anything published may have changed.
  revalidatePath('/', 'layout')
}

function dataInput(form: FormData): DataInput {
  const input: DataInput = {}
  for (const f of DATA_FIELDS) input[f.name] = f.kind === 'labels' ? form.getAll(f.name).map(String) : str(form, f.name)
  return input
}

const VARIANT_FIELDS = ['size', 'unit', 'priceCents', 'promoPriceCents', 'stock', 'isMain', 'durationDays', 'weightGrams', 'barcode', 'heightCm', 'widthCm', 'lengthCm', 'costCents']
const variantInput = (form: FormData): VariantInput => Object.fromEntries(VARIANT_FIELDS.map((k) => [k, str(form, k)]))

export async function bulkStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await bulkSetStatus(getDb(), admin, form.getAll('ids').map(String), str(form, 'status'))
  touched()
  return result
}

export async function createProductAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const s = await getSettings()
  const input = { ...dataInput(form), code: str(form, 'code'), sku: str(form, 'sku'), size: str(form, 'size'), unit: str(form, 'unit'), priceCents: str(form, 'priceCents'), stock: str(form, 'stock') }
  const result = await createProduct(getDb(), admin, input, { canCost: can(admin.role, 'catalog.cost'), dermatologistLabelEnabled: s['catalog.dermatologistLabelEnabled'] })
  if (!result.ok || !result.code) return result
  touched()
  redirect(`/productos/${result.code}?creado=1`)
}

export async function saveDataAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const s = await getSettings()
  const result = await saveProductData(getDb(), admin, code, dataInput(form), { dermatologistLabelEnabled: s['catalog.dermatologistLabelEnabled'] })
  touched(code)
  return result
}

export async function publishAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const db = getDb()
  const op = str(form, 'op')
  const result = op === 'publicar-cambios' ? await publishDraft(db, admin, code) : op === 'descartar' ? await discardDraft(db, admin, code) : await publishProduct(db, admin, code)
  touched(code)
  return result
}

export async function statusAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await setProductStatus(getDb(), admin, code, str(form, 'status'))
  touched(code)
  return result
}

export async function deleteProductAction(code: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await deleteProduct(getDb(), admin, code)
  if (!result.ok) return result
  touched()
  redirect('/productos?borrado=1')
}

export async function createVariantAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await createVariant(getDb(), admin, code, str(form, 'sku'), variantInput(form), can(admin.role, 'catalog.cost'))
  touched(code)
  return result
}

export async function updateVariantAction(code: string, sku: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const db = getDb()
  const result =
    str(form, 'op') === 'borrar' ? await deleteVariant(db, admin, sku, can(admin.role, 'catalog.cost')) : await updateVariant(db, admin, sku, variantInput(form), can(admin.role, 'catalog.cost'))
  touched(code)
  return result
}

export async function ingredientsAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const stars: StarInput[] = form.getAll('codes').map((c) => {
    const ingredient = String(c)
    return { code: ingredient, isStar: bool(form, `star.${ingredient}`), concentration: str(form, `conc.${ingredient}`) || null }
  })
  const extra = str(form, 'extra')
  if (extra) stars.push({ code: extra, isStar: true, concentration: str(form, 'extraConc') || null })
  const result = await saveProductIngredients(getDb(), admin, code, { inciText: str(form, 'inciText'), stars })
  touched(code)
  return result
}

export async function concernsAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const entries = form.getAll('concernIds').map((id) => ({ concernId: String(id), relevance: str(form, `relevance.${String(id)}`) }))
  const result = await saveProductConcerns(getDb(), admin, code, entries)
  touched(code)
  return result
}

export async function skinTypesAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const entries = form.getAll('skinTypeIds').map((id) => ({ skinTypeId: String(id), aptitude: str(form, `aptitude.${String(id)}`) }))
  const result = await saveProductSkinTypes(getDb(), admin, code, entries)
  touched(code)
  return result
}

export async function relationsAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const codes = (name: string) =>
    str(form, name)
      .split(/[\r\n;,]+/)
      .map((c) => c.trim())
      .filter(Boolean)
  const input = Object.fromEntries(RELATION_KINDS.map(({ kind }) => [kind, codes(kind)])) as Parameters<typeof saveProductRelations>[3]
  const result = await saveProductRelations(getDb(), admin, code, input)
  touched(code)
  return result
}

export async function addImagesAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await addProductImages(getDb(), admin, code, await files(form, 'images'))
  touched(code)
  return result
}

export async function imageAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const result = await changeProductImage(getDb(), admin, code, str(form, 'op'), Number(str(form, 'index')))
  touched(code)
  return result
}

export async function videoAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('catalog.edit')
  const [file] = await files(form, 'videoFile')
  const result = await saveProductVideo(getDb(), admin, code, { url: str(form, 'videoUrl'), file, remove: bool(form, 'removeVideo') })
  touched(code)
  return result
}
