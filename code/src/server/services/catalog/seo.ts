// Absolute URLs for metadata, JSON-LD and the sitemap. Same base as the root
// layout's metadataBase.
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith('/') ? '' : '/'}${path}`)

/** JSON for a <script type="application/ld+json">, safe against a "</script>" inside panel text. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
