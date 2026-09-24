// Turns the raw generations in images-raw/ into the web assets in public/images
// and writes src/content/image-manifest.json (size, backdrop colour, blur).
//
// Packshots are re-framed so every product sits at the same scale and baseline:
// the product is detected against its backdrop, then a 4:5 crop is cut around
// it. That is what makes a grid of 18 generated images read as one shoot.
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const RAW = path.join(root, 'images-raw')
const OUT = path.join(root, 'public/images')
const MANIFEST = path.join(root, 'src/content/image-manifest.json')

const PRODUCT_HEIGHT = 0.6 // share of the frame height the product fills
const PRODUCT_WIDTH = 0.56 // cap for wide packs such as jars
const BASELINE = 0.83 // where the bottom of the product sits
const PACKSHOT = { width: 1200, height: 1500 }
// Where the phone crop of each hero sits, as object-position x: all three
// models and their products fall inside it.
const PHONE_CROPS = { 'hero-1': 0.94, 'hero-2': 1, 'hero-3': 0.94 }

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

async function blurData(pipeline) {
  const buf = await pipeline.clone().resize(12).jpeg({ quality: 60 }).toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

// Finds the product's bounding box from edges. The paper sweep, its vignette
// and the soft cast shadow are all smooth gradients; the pack has hard edges
// (outline, cap, label, type). A Sobel pass at 1/8 scale separates the two.
async function productBox(file) {
  const scale = 0.125
  const { width } = await sharp(file).metadata()
  const { data, info } = await sharp(file)
    .removeAlpha()
    .greyscale()
    .resize(Math.round(width * scale))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const g = (x, y) => data[y * w + x]
  const mask = new Uint8Array(w * h)
  const margin = 3
  for (let y = margin; y < h - margin; y++) {
    for (let x = margin; x < w - margin; x++) {
      const gx = -g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1) + g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1)
      const gy = -g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1) + g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)
      if (Math.hypot(gx, gy) > 40) mask[y * w + x] = 1
    }
  }
  // Rows and columns need a run of product pixels to count, which drops
  // specks of noise and most of the soft floor shadow.
  const rowHits = (y) => { let n = 0; for (let x = 0; x < w; x++) n += mask[y * w + x]; return n }
  const minRun = Math.max(3, Math.round(w * 0.02))
  let top = 0, bottom = h - 1
  while (top < h && rowHits(top) < minRun) top++
  while (bottom > top && rowHits(bottom) < minRun) bottom--
  // Horizontal extent from the upper 75% of the product only: the cast shadow
  // lives on the floor, next to the base.
  const bandEnd = top + Math.round((bottom - top) * 0.75)
  const colHits = new Array(w).fill(0)
  for (let y = top; y <= bandEnd; y++) for (let x = 0; x < w; x++) colHits[x] += mask[y * w + x]
  const minCol = Math.max(2, Math.round((bandEnd - top) * 0.04))
  let left = 0, right = w - 1
  while (left < w && colHits[left] < minCol) left++
  while (right > left && colHits[right] < minCol) right--
  return { top: top / scale, bottom: bottom / scale, left: left / scale, right: right / scale }
}

async function processPackshot(file, slug) {
  const meta = await sharp(file).metadata()
  const box = await productBox(file)
  const pw = box.right - box.left
  const ph = box.bottom - box.top
  let cropH = Math.max(ph / PRODUCT_HEIGHT, pw / (PRODUCT_WIDTH * 0.8))
  cropH = Math.min(cropH, meta.height, meta.width / 0.8)
  const cropW = cropH * 0.8
  const cx = (box.left + box.right) / 2
  let left = Math.round(cx - cropW / 2)
  let top = Math.round(box.bottom - BASELINE * cropH)
  left = Math.max(0, Math.min(left, meta.width - Math.round(cropW)))
  top = Math.max(0, Math.min(top, meta.height - Math.round(cropH)))

  const buffer = await sharp(file)
    .extract({ left, top, width: Math.round(cropW), height: Math.round(cropH) })
    .resize(PACKSHOT.width, PACKSHOT.height, { fit: 'cover' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()

  // Backdrop colour: the mean of the paper strips either side of the product.
  const strip = { top: 300, width: 70, height: 600 }
  const sides = await Promise.all(
    [0, PACKSHOT.width - strip.width].map(async (x) => (await sharp(buffer).extract({ left: x, ...strip }).stats()).channels),
  )
  const color = hex([0, 1, 2].map((c) => (sides[0][c].mean + sides[1][c].mean) / 2))

  const fill = ((ph / cropH) * 100).toFixed(0)
  console.log(`products/${slug.padEnd(32)} product ${Math.round(pw)}x${Math.round(ph)} -> crop ${Math.round(cropW)}x${Math.round(cropH)} (fills ${fill}% height) ${color}`)
  return { src: await writeHashed(buffer, 'products', slug), ...PACKSHOT, color, blur: await blurData(sharp(buffer)) }
}

// File names carry a content hash, so a changed image always gets a new URL
// and no image cache (the Next.js optimizer, Vercel, browsers) can serve the
// old one.
async function writeHashed(buffer, dir, name) {
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 8)
  const file = `${name}.${hash}.jpg`
  await writeFile(path.join(OUT, dir, file), buffer)
  return `/images/${dir}/${file}`
}

async function main() {
  // Start clean: stale files would otherwise linger under old hashes.
  await rm(OUT, { recursive: true, force: true })
  for (const d of ['products', 'lifestyle']) await mkdir(path.join(OUT, d), { recursive: true })
  await mkdir(path.join(root, 'src/app'), { recursive: true })
  const manifest = {}

  for (const f of (await readdir(path.join(RAW, 'products'))).sort()) {
    const slug = path.basename(f, path.extname(f))
    manifest[`products/${slug}`] = await processPackshot(path.join(RAW, 'products', f), slug)
  }

  // Campaign images: the products advertised in use. Wide ones at full size (up to 3200px), portraits at 1200x1500.
  for (const f of (await readdir(path.join(RAW, 'lifestyle'))).sort()) {
    const name = path.basename(f, path.extname(f))
    const file = path.join(RAW, 'lifestyle', f)
    const meta = await sharp(file).metadata()
    const wide = meta.width / meta.height > 1.2
    const w = Math.min(meta.width, 3200)
    const size = wide ? { width: w, height: Math.round((w * meta.height) / meta.width) } : { width: 1200, height: 1500 }
    const buffer = await sharp(file).resize(size.width, size.height, { fit: 'cover' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
    manifest[`lifestyle/${name}`] = { src: await writeHashed(buffer, 'lifestyle', name), ...size, blur: await blurData(sharp(buffer)) }
    console.log(`lifestyle/${name.padEnd(16)} ${size.width}x${size.height}`)
  }

  // Phone crops of the hero campaigns: the 4:5 window on the group, so phones
  // download a small image instead of a wide one they would show a third of.
  // `crop` (fractions of the wide image) lets the page move the hotspots.
  for (const [name, x] of Object.entries(PHONE_CROPS)) {
    const file = path.join(RAW, 'lifestyle', `${name}.png`)
    const meta = await sharp(file).metadata()
    const width = Math.round(meta.height * 0.8)
    const left = Math.round(x * (meta.width - width))
    const buffer = await sharp(file)
      .extract({ left, top: 0, width, height: meta.height })
      .resize(1080, 1350)
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
    manifest[`lifestyle/${name}-phone`] = {
      src: await writeHashed(buffer, 'lifestyle', `${name}-phone`),
      width: 1080,
      height: 1350,
      blur: await blurData(sharp(buffer)),
      crop: { left: +(left / meta.width).toFixed(4), width: +(width / meta.width).toFixed(4) },
    }
    console.log(`lifestyle/${`${name}-phone`.padEnd(16)} 1080x1350 from x ${left}`)
  }

  // Share image (1200x630): the first hero campaign.
  await sharp(path.join(RAW, 'lifestyle/hero-1.png'))
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(root, 'src/app/opengraph-image.jpg'))

  await mkdir(path.dirname(MANIFEST), { recursive: true })
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nWrote ${Object.keys(manifest).length} entries to ${path.relative(root, MANIFEST)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
