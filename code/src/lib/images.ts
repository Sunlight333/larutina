import type { CSSProperties } from 'react'
import manifest from '@/content/image-manifest.json'

// The campaign photographs of the approved design (public/images/lifestyle).
// They are the default imagery of the Home blocks and the page headers: a
// block or page with an image of its own from the panel shows that one
// instead. Product photos never come from here; they come from the catalog.

export type ImageAsset = {
  src: string
  width: number
  height: number
  blur: string
  color?: string
  /** Phone crops of a wide image: where the crop sits in it, as fractions of its width. */
  crop?: { left: number; width: number }
}

const assets = manifest as Record<string, ImageAsset>

export type LifestyleName =
  | 'hero-1'
  | 'hero-2'
  | 'hero-3'
  | 'bodegon'
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

// Where the face is in each campaign portrait (fractions of width and height),
// so small round crops can zoom onto it instead of showing a tiny figure.
const FACES: Partial<Record<LifestyleName, [number, number]>> = {
  acne: [0.48, 0.42],
  manchas: [0.48, 0.38],
  deshidratacion: [0.46, 0.45],
  sensibilidad: [0.49, 0.35],
  lineas: [0.58, 0.3],
  poros: [0.52, 0.4],
  manana: [0.48, 0.35],
  noche: [0.55, 0.37],
  ficha: [0.41, 0.3],
  diagnostico: [0.43, 0.29],
}

export type CampaignImage = ImageAsset & { face?: [number, number] }

/** The campaign photographs: the imagery for everything that is not a product display. */
export function lifestyleImage(name: LifestyleName | `${LifestyleName}-phone`): CampaignImage {
  const asset = assets[`lifestyle/${name}`]
  if (!asset) throw new Error(`Missing lifestyle image ${name}`)
  return { ...asset, face: FACES[name as LifestyleName] }
}

// The portrait of each need, by the catalog's need codes (and the short forms
// the design used). A need without its own portrait takes one of the set by
// its position, so a new need never shows an empty arch.
const CONCERN_PORTRAITS: Record<string, LifestyleName> = {
  acne: 'acne',
  manchas: 'manchas',
  deshidratacion: 'deshidratacion',
  sensibilidad: 'sensibilidad',
  'rojeces-sensibilidad': 'sensibilidad',
  rojeces: 'sensibilidad',
  lineas: 'lineas',
  'lineas-firmeza': 'lineas',
  poros: 'poros',
  'poros-brillo': 'poros',
  luminosidad: 'ficha',
}
const PORTRAIT_CYCLE: LifestyleName[] = ['acne', 'manchas', 'deshidratacion', 'sensibilidad', 'lineas', 'poros', 'ficha', 'diagnostico', 'manana', 'noche']

export function concernPortrait(code: string, index = 0): CampaignImage {
  return lifestyleImage(CONCERN_PORTRAITS[code] ?? PORTRAIT_CYCLE[index % PORTRAIT_CYCLE.length]!)
}

/**
 * Style for a tight crop of a campaign photograph, centred on a point (the
 * face, or a model and her product) and zoomed in. `frame` is the aspect ratio
 * of the box the image fills with object-cover. On each axis, object-position
 * first brings the point as close to the middle as the crop allows; the zoom
 * origin then lands it in the middle, so the image always covers the box.
 * Callers size the image for the zoomed width (`sizes`), or it looks soft.
 */
export function faceCrop(img: { face?: [number, number]; width: number; height: number }, zoom = 1.8, frame = 1): CSSProperties {
  if (!img.face) return {}
  const ar = img.width / img.height
  const axis = (q: number, shown: number) => {
    const position = shown >= 1 ? 0.5 : clamp((q - shown / 2) / (1 - shown))
    const inFrame = shown >= 1 ? q : (q - position * (1 - shown)) / shown
    const origin = zoom > 1 ? clamp((inFrame * zoom - 0.5) / (zoom - 1)) : 0.5
    return { position: pct(position), origin: pct(origin) }
  }
  const x = axis(img.face[0], Math.min(1, frame / ar))
  const y = axis(img.face[1], Math.min(1, ar / frame))
  return { objectPosition: `${x.position} ${y.position}`, transform: `scale(${zoom})`, transformOrigin: `${x.origin} ${y.origin}` }
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
