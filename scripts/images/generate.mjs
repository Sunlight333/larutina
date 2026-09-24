// Generates the demo imagery on Replicate into images-raw/, from which
// `npm run images` builds the web assets. Reads REPLICATE_API_TOKEN from the
// environment and never prints it.
//
//   node --env-file=.env scripts/images/generate.mjs packshots [slug ...]
//   node --env-file=.env scripts/images/generate.mjs concerns  [slug ...]
//   node --env-file=.env scripts/images/generate.mjs editorial [hero|still-life-wide]
//
// Models, chosen by comparing the top text-to-image models on Replicate on
// the same packshot prompt (September 2026):
//   - Packshots and editorial: google/nano-banana-pro. Best label typography
//     (accents included), a true seamless backdrop, and reference-image input
//     so editorial scenes reuse the real packshots.
//   - Concern textures: black-forest-labs/flux-2-max. Most photographic
//     material detail; no text involved.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EDITORIAL, EDITORIAL_REFERENCES, PRODUCTS, TEXTURES, packshotPrompt, texturePrompt } from './prompts.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RAW = path.join(root, 'images-raw')
const token = process.env.REPLICATE_API_TOKEN
if (!token) {
  console.error('REPLICATE_API_TOKEN is not set. Run with: node --env-file=.env scripts/images/generate.mjs …')
  process.exit(1)
}
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dataUri(file) {
  const buf = await readFile(file)
  return `data:image/png;base64,${buf.toString('base64')}`
}

async function predict(model, input) {
  for (let attempt = 1; ; attempt++) {
    let res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'wait=60' },
      body: JSON.stringify({ input }),
    })
    let pred = await res.json()
    if (res.status === 429 && attempt < 4) {
      await sleep(((pred.retry_after ?? 5) + 1) * 1000)
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(pred).slice(0, 200)}`)
    const started = Date.now()
    while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
      if (Date.now() - started > 8 * 60_000) throw new Error('timed out')
      await sleep(3000)
      res = await fetch(pred.urls.get, { headers })
      pred = await res.json()
    }
    if (pred.status !== 'succeeded') throw new Error(`${pred.status}: ${pred.error ?? ''}`)
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
    return Buffer.from(await (await fetch(url)).arrayBuffer())
  }
}

function jobsFor(kind, only) {
  const pick = (slug) => only.length === 0 || only.includes(slug)
  if (kind === 'packshots') {
    return PRODUCTS.filter((p) => pick(p.slug)).map((p) => ({
      out: path.join(RAW, 'products', `${p.slug}.png`),
      model: 'google/nano-banana-pro',
      input: async () => ({ prompt: packshotPrompt(p), aspect_ratio: '4:5', resolution: '2K', output_format: 'png' }),
    }))
  }
  if (kind === 'concerns') {
    return Object.keys(TEXTURES)
      .filter(pick)
      .map((slug) => ({
        out: path.join(RAW, 'concerns', `${slug}.png`),
        model: 'black-forest-labs/flux-2-max',
        input: async () => ({ prompt: texturePrompt(slug), aspect_ratio: '1:1', resolution: '1 MP', output_format: 'png' }),
      }))
  }
  if (kind === 'editorial') {
    return Object.entries(EDITORIAL)
      .filter(([name]) => pick(name))
      .map(([name, e]) => ({
        out: path.join(RAW, 'editorial', `${name}.png`),
        model: 'google/nano-banana-pro',
        input: async () => ({
          prompt: e.prompt,
          image_input: await Promise.all(EDITORIAL_REFERENCES.map((s) => dataUri(path.join(RAW, 'products', `${s}.png`)))),
          aspect_ratio: e.aspect,
          resolution: '2K',
          output_format: 'png',
        }),
      }))
  }
  throw new Error(`Unknown kind "${kind}". Use packshots, concerns or editorial.`)
}

const [kind, ...only] = process.argv.slice(2)
const jobs = jobsFor(kind, only)
const queue = [...jobs]
const failed = []

// Three at a time: Replicate allows a burst of five on low-credit accounts.
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const job = queue.shift()
      try {
        const buf = await predict(job.model, await job.input())
        await mkdir(path.dirname(job.out), { recursive: true })
        await writeFile(job.out, buf)
        console.log(`ok   ${path.relative(root, job.out)}`)
      } catch (e) {
        failed.push(job.out)
        console.log(`fail ${path.relative(root, job.out)}: ${e.message}`)
      }
    }
  }),
)
console.log(`\n${jobs.length - failed.length}/${jobs.length} generated. Next: npm run images`)
if (failed.length) process.exit(1)
