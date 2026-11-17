// Fixes small product labels that came out garbled in a campaign photograph.
// A whole-image edit tends to fix one label and scramble another, so this
// edits only an enlarged crop around the products (labels large enough to
// render correctly), registers the result back onto the original crop, and
// blends in just the label patches with feathered edges. The original is kept
// in images-raw/retouch/. Reads REPLICATE_API_TOKEN from the environment.
//
//   node --env-file=.env scripts/images/retouch-labels.mjs scripts/images/retouch/hero-1.json
//
// Config: image (campaign name), crop and patches (pixels in the raw image),
// aspect of the crop, refs (packshot slugs, references 2…), prompt, and
// optionally reuse (a saved crop edit, to re-blend without a new generation).
import sharp from 'sharp'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RAW = path.join(root, 'images-raw')
const cfg = JSON.parse(await readFile(process.argv[2], 'utf8'))
const file = path.join(RAW, 'lifestyle', `${cfg.image}.png`)
const { crop, patches, scale = 2, feather = 8 } = cfg
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function predict(input) {
  const headers = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' }
  let res = await fetch('https://api.replicate.com/v1/models/google/nano-banana-pro/predictions', {
    method: 'POST',
    headers: { ...headers, Prefer: 'wait=60' },
    body: JSON.stringify({ input }),
  })
  let pred = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(pred).slice(0, 200)}`)
  while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    await sleep(3000)
    pred = await (await fetch(pred.urls.get, { headers })).json()
  }
  if (pred.status !== 'succeeded') throw new Error(`${pred.status}: ${pred.error ?? ''}`)
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  return Buffer.from(await (await fetch(url)).arrayBuffer())
}

const original = await sharp(file).extract(crop).png().toBuffer()
await mkdir(path.join(RAW, 'retouch'), { recursive: true })
let edited
if (cfg.reuse) edited = await readFile(path.resolve(root, cfg.reuse))
else {
  const uri = (b) => `data:image/png;base64,${b.toString('base64')}`
  const big = await sharp(original).resize(crop.width * scale, crop.height * scale, { kernel: 'lanczos3' }).png().toBuffer()
  const refs = await Promise.all(cfg.refs.map((s) => readFile(path.join(RAW, 'products', `${s}.png`))))
  edited = await predict({ prompt: cfg.prompt, image_input: [uri(big), ...refs.map(uri)], aspect_ratio: cfg.aspect, resolution: '2K', output_format: 'png' })
  await writeFile(path.join(RAW, 'retouch', `${cfg.image}-crop-edit.png`), edited)
}
const back = await sharp(edited).resize(crop.width, crop.height, { kernel: 'lanczos3' }).png().toBuffer()

// Registration: the offset that best lines the edit up with the original,
// comparing everything outside the patches.
const grey = (b) => sharp(b).greyscale().raw().toBuffer({ resolveWithObject: true })
const a = await grey(original)
const e = await grey(back)
const W = a.info.width
const H = a.info.height
const inPatch = (x, y) => patches.some((p) => x >= p.left - crop.left && x < p.left - crop.left + p.width && y >= p.top - crop.top && y < p.top - crop.top + p.height)
let best = { dx: 0, dy: 0, err: Infinity }
for (let dy = -24; dy <= 24; dy++) {
  for (let dx = -24; dx <= 24; dx++) {
    let err = 0
    let n = 0
    for (let y = 30; y < H - 30; y += 3) {
      for (let x = 30; x < W - 30; x += 3) {
        if (inPatch(x, y)) continue
        err += Math.abs(a.data[y * W + x] - e.data[(y + dy) * W + x + dx])
        n++
      }
    }
    if (err / n < best.err) best = { dx, dy, err: err / n }
  }
}
console.log('registration offset', best)

const backup = path.join(RAW, 'retouch', `${cfg.image}.${Date.now()}.png`)
await copyFile(file, backup)
const layers = []
for (const p of patches) {
  const src = await sharp(back)
    .extract({ left: p.left - crop.left + best.dx, top: p.top - crop.top + best.dy, width: p.width, height: p.height })
    .ensureAlpha()
    .raw()
    .toBuffer()
  // Feathered rectangle: opaque inside, a linear ramp over `feather` px at each edge.
  const ramp = (d) => Math.max(0, Math.min(1, d / feather))
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      src[(y * p.width + x) * 4 + 3] = Math.round(255 * ramp(Math.min(x, p.width - 1 - x)) * ramp(Math.min(y, p.height - 1 - y)))
    }
  }
  layers.push({ input: src, raw: { width: p.width, height: p.height, channels: 4 }, left: p.left, top: p.top })
}
await sharp(backup).composite(layers).png().toFile(file)
console.log(`patched ${path.relative(root, file)}; original kept as ${path.relative(root, backup)}`)
