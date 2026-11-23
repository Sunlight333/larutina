import Image from 'next/image'
import Link from 'next/link'
import type { ResolvedImage } from '@/server/media'
import { longDate } from './format'

// An article in the journal list and in "Artículos relacionados".
export function ArticleCardView({ href, title, excerpt, category, date, image }: { href: string; title: string; excerpt: string; category?: string; date: Date; image?: ResolvedImage }) {
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-image)] bg-sand">
        {image && <Image src={image.src} alt="" fill sizes="(min-width: 64rem) 24rem, (min-width: 40rem) 45vw, 92vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.08em] text-ink-muted">
        {category ? `${category} · ` : ''}
        <time dateTime={date.toISOString()}>{longDate(date)}</time>
      </p>
      <h3 className="mt-2 font-display text-[1.5rem] leading-tight text-balance group-hover:underline group-hover:underline-offset-4">{title}</h3>
      {excerpt && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{excerpt}</p>}
    </Link>
  )
}
