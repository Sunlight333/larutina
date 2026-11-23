// Article structured data (CMS-02: passes Google's rich results test):
// headline, image, author, dates, publisher and, when a professional
// reviewed it, reviewedBy.

export function articleJsonLd(input: {
  url: string
  headline: string
  description: string
  image: string | null
  author: string
  brandName: string
  publisher: string
  datePublished: Date
  dateModified: Date
  reviewedBy: string
}) {
  const isBrand = !input.author || input.author.toLowerCase() === input.brandName.toLowerCase()
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline.slice(0, 110),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: [input.image] } : {}),
    author: isBrand ? { '@type': 'Organization', name: input.brandName, url: new URL('/', input.url).toString() } : { '@type': 'Person', name: input.author },
    publisher: { '@type': 'Organization', name: input.publisher },
    datePublished: input.datePublished.toISOString(),
    dateModified: input.dateModified.toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    ...(input.reviewedBy ? { reviewedBy: { '@type': 'Person', name: input.reviewedBy } } : {}),
  }
}
