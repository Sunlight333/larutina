import manifest from '@/content/image-manifest.json'

export type ImageAsset = {
  src: string
  width: number
  height: number
  blur: string
  color?: string
}

const assets = manifest as Record<string, ImageAsset>

/**
 * Product photos are looked up by slug. When the client sends real photos,
 * they replace the files under public/images/products and the manifest is
 * regenerated with `npm run images`; no code changes.
 */
export function productImage(slug: string): ImageAsset | undefined {
  return assets[`products/${slug}`]
}

export type LifestyleName =
  | 'hero'
  | 'manana'
  | 'noche'
  | 'ficha'
  | 'diagnostico'
  | 'acne'
  | 'manchas'
  | 'deshidratacion'
  | 'sensibilidad'
  | 'lineas'
  | 'poros'

/** Scenes of the products in use: the imagery for everything that is not a product display. */
export function lifestyleImage(name: LifestyleName | string): ImageAsset {
  const asset = assets[`lifestyle/${name}`]
  if (!asset) throw new Error(`Missing lifestyle image ${name}; run npm run images`)
  return asset
}
