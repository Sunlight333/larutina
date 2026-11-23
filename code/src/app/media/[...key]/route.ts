import { getDb } from '@/server/db'
import { storage } from '@/server/storage'

// Public media only. Keys are unique per upload, so files are cached for a
// year; next/image fetches from here to make the optimized sizes.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.map(decodeURIComponent).join('/')
  if (!key.startsWith('public/')) return new Response('Not found', { status: 404 })
  const asset = await getDb().mediaAsset.findUnique({ where: { key } })
  if (!asset || asset.visibility !== 'PUBLIC' || asset.deletedAt) return new Response('Not found', { status: 404 })
  const data = await storage().get(key)
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
