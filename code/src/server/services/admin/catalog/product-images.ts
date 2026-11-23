// Product images and video (CAT-17). Product.images holds media keys or the
// template's file names (resolveImages finds both); the first is the main
// image. Operational, so changes apply at once and are audited.
import type { MediaAsset } from '@prisma/client'
import { audit } from '@/server/audit'
import { mediaUrl, PRODUCT_IMAGE_MIN, safeFileName, saveUpload, UploadError, type UploadInput } from '@/server/media'
import { fail, ok, type Actor, type Db, type Result } from './common'

/** Below 1600 × 2000 or not 4:5: a warning, never a refusal (the site still optimizes it). */
export function imageWarnings(a: Pick<MediaAsset, 'width' | 'height'>): string[] {
  const out: string[] = []
  if (!a.width || !a.height) return out
  if (a.width < PRODUCT_IMAGE_MIN.width || a.height < PRODUCT_IMAGE_MIN.height) out.push(`Mide ${a.width} × ${a.height} px; lo recomendado es ${PRODUCT_IMAGE_MIN.width} × ${PRODUCT_IMAGE_MIN.height} o más.`)
  if (Math.abs(a.width / a.height - 4 / 5) > 0.01) out.push('No es 4:5: en la ficha se recorta.')
  return out
}

/** Each image reference with its asset, when one was uploaded. */
export async function imageAssets(db: Db, refs: string[]) {
  const names = refs.map(safeFileName)
  const assets = refs.length
    ? await db.mediaAsset.findMany({ where: { visibility: 'PUBLIC', deletedAt: null, OR: [{ key: { in: refs } }, { fileName: { in: names } }] }, orderBy: { createdAt: 'desc' } })
    : []
  return refs.map((ref) => {
    const asset = assets.find((a) => a.key === ref) ?? assets.find((a) => a.fileName === safeFileName(ref)) ?? null
    return { ref, asset, url: asset ? mediaUrl(asset.key) : null, warnings: asset ? imageWarnings(asset) : [] }
  })
}

async function productOf(db: Db, code: string) {
  return db.product.findFirst({ where: { code, deletedAt: null }, select: { id: true, code: true, name: true, images: true, videoUrl: true } })
}

export async function addProductImages(db: Db, actor: Actor, code: string, files: UploadInput[]): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  if (!files.length) return fail('Elegí al menos una imagen.', { images: 'Elegí al menos una imagen.' })
  const uploaded: MediaAsset[] = []
  try {
    for (const f of files) uploaded.push(await saveUpload(db, f, { visibility: 'PUBLIC', createdBy: actor.email, alt: product.name }))
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { images: e.message })
    throw e
  }
  const images = [...product.images, ...uploaded.map((a) => a.key)]
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { images } })
    await audit(tx, actor, { action: 'images.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before: { images: product.images }, after: { images } })
  })
  const warnings = uploaded.flatMap((a) => imageWarnings(a).map((w) => `${a.fileName}: ${w}`))
  return ok([`${uploaded.length === 1 ? 'Imagen agregada' : `${uploaded.length} imágenes agregadas`}.`, ...warnings].join(' '))
}

/** "subir", "bajar", "principal" or "quitar" on the image at `index`. */
export async function changeProductImage(db: Db, actor: Actor, code: string, op: string, index: number): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  const images = [...product.images]
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return fail('La imagen ya no está.')
  const swap = (j: number) => {
    if (j < 0 || j >= images.length) return
    ;[images[index], images[j]] = [images[j]!, images[index]!]
  }
  if (op === 'subir') swap(index - 1)
  else if (op === 'bajar') swap(index + 1)
  else if (op === 'principal') images.unshift(...images.splice(index, 1))
  else if (op === 'quitar') images.splice(index, 1)
  else return fail('Acción desconocida.')
  if (JSON.stringify(images) === JSON.stringify(product.images)) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { images } })
    await audit(tx, actor, { action: 'images.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before: { images: product.images }, after: { images } })
  })
  return ok(op === 'quitar' ? 'Imagen quitada del producto (el archivo queda en Imágenes).' : 'Orden guardado.')
}

/** Video: an MP4 up to 20 MB uploaded here, or a YouTube or Vimeo link (CAT-17). */
export async function saveProductVideo(db: Db, actor: Actor, code: string, input: { url: string; file?: UploadInput; remove: boolean }): Promise<Result> {
  const product = await productOf(db, code)
  if (!product) return fail('El producto no existe.')
  let videoUrl: string | null
  if (input.remove) videoUrl = null
  else if (input.file) {
    if (input.file.type !== 'video/mp4') return fail('El video tiene que ser MP4.', { videoFile: 'El video tiene que ser MP4.' })
    try {
      videoUrl = mediaUrl((await saveUpload(db, input.file, { visibility: 'PUBLIC', createdBy: actor.email, allowVideo: true })).key)
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message, { videoFile: e.message })
      throw e
    }
  } else {
    const url = input.url.trim()
    if (url && !/^https:\/\/\S+$/.test(url) && !url.startsWith('/media/')) return fail('El link tiene que empezar con https://', { videoUrl: 'El link tiene que empezar con https://' })
    videoUrl = url || null
  }
  if (videoUrl === product.videoUrl) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { videoUrl } })
    await audit(tx, actor, { action: 'video.update', entityType: 'Product', entityId: product.id, label: `${product.name} (${product.code})`, before: { videoUrl: product.videoUrl }, after: { videoUrl } })
  })
  return ok(videoUrl ? 'Video guardado.' : 'Video quitado.')
}
