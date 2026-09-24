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

export function concernImage(slug: string): ImageAsset | undefined {
  return assets[`concerns/${slug}`]
}

export function editorialImage(name: 'hero' | 'still-life-wide'): ImageAsset {
  const asset = assets[`editorial/${name}`]
  if (!asset) throw new Error(`Missing editorial image ${name}; run npm run images`)
  return asset
}
