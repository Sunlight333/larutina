import { renderMarkdown, type MarkdownOptions } from '@/lib/markdown'

// Panel Markdown (src/lib/markdown) with the site's type: rich text blocks,
// FAQ answers, journal articles and legal documents.

const classes: MarkdownOptions['className'] = {
  h2: 'mt-10 font-display text-display-sm text-balance',
  h3: 'mt-8 text-lg font-medium',
  p: 'mt-4 leading-relaxed',
  ul: 'mt-4 list-disc space-y-2 pl-5 marker:text-ink-muted',
  ol: 'mt-4 list-decimal space-y-2 pl-5 marker:text-ink-muted',
  li: 'pl-1 leading-relaxed',
  blockquote: 'mt-6 border-l-2 border-accent pl-4 text-ink-soft [&>p]:mt-2',
  a: 'underline decoration-line-strong underline-offset-[5px] hover:decoration-ink',
}

export function Prose({ source, className = '' }: { source: string; className?: string }) {
  return <div className={`text-ink-soft [&>*:first-child]:mt-0 ${className}`}>{renderMarkdown(source, { className: classes })}</div>
}
