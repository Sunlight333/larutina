import type { MetadataRoute } from 'next'

// The demo is never indexed (plan §8). Also enforced with X-Robots-Tag and
// the robots meta tag.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
