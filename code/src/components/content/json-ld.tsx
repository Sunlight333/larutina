// Structured data for Google (FAQPage, Article). "<" is escaped so a text
// from the panel can never close the script element.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
