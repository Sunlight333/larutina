// ENV-04, CAT-11: an order ships in the smallest standard box its products
// fit in, and its weight is the products plus the empty box. Any product
// without measurements sends the order to the default box. Pure.

export type Parcel = { heightCm: number | null; widthCm: number | null; lengthCm: number | null; weightGrams: number | null; quantity: number }
export type Box = { code: string; heightCm: number; widthCm: number; lengthCm: number; emptyWeightGrams: number; maxWeightGrams: number | null; isDefault: boolean }

/** How full a box can be packed: products never fill a box exactly. */
export const FILL = 0.8

const dims = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => y - x) as [number, number, number]
const volume = (b: { heightCm: number; widthCm: number; lengthCm: number }) => b.heightCm * b.widthCm * b.lengthCm

export type BoxChoice = { box: Box | null; weightGrams: number; reason: 'fits' | 'no-measurements' | 'too-big' | 'no-boxes' }

export function chooseBox(parcels: Parcel[], boxes: Box[]): BoxChoice {
  const items = parcels.filter((p) => p.quantity > 0)
  const productsWeight = items.reduce((g, p) => g + (p.weightGrams ?? 0) * p.quantity, 0)
  const usable = boxes.filter((b) => volume(b) > 0).sort((a, b) => volume(a) - volume(b))
  const fallback = usable.find((b) => b.isDefault) ?? null
  const weigh = (box: Box | null) => productsWeight + (box?.emptyWeightGrams ?? 0)
  if (!usable.length) return { box: null, weightGrams: weigh(null), reason: 'no-boxes' }

  const measured = items.every((p) => p.heightCm && p.widthCm && p.lengthCm)
  if (!measured) return { box: fallback ?? usable[usable.length - 1]!, weightGrams: weigh(fallback ?? usable[usable.length - 1]!), reason: 'no-measurements' }

  const itemsVolume = items.reduce((v, p) => v + p.heightCm! * p.widthCm! * p.lengthCm! * p.quantity, 0)
  const largestItem = items.map((p) => dims(p.heightCm!, p.widthCm!, p.lengthCm!))
  for (const box of usable) {
    const inside = dims(box.heightCm, box.widthCm, box.lengthCm)
    const eachFits = largestItem.every((d) => d[0] <= inside[0] && d[1] <= inside[1] && d[2] <= inside[2])
    const volumeFits = itemsVolume <= volume(box) * FILL
    const weightFits = box.maxWeightGrams == null || weigh(box) <= box.maxWeightGrams
    if (eachFits && volumeFits && weightFits) return { box, weightGrams: weigh(box), reason: 'fits' }
  }
  // Nothing fits: the largest box, flagged, so the team can split the parcel.
  const largest = usable[usable.length - 1]!
  return { box: largest, weightGrams: weigh(largest), reason: 'too-big' }
}
