import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (deploy/).
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    // Panel uploads go through server actions: catalog spreadsheets, product
    // images (≤ 15 MB each, several at once) and videos (≤ 20 MB, CAT-17).
    serverActions: { bodySizeLimit: '60mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Media keys are unique per upload, so an optimized size never changes.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    // Indexing is decided by the panel (site.indexing) through the robots
    // meta tag and robots.txt. The panel itself is never indexed: on its host
    // (admin.…) src/proxy.ts adds X-Robots-Tag and Cache-Control: no-store.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
