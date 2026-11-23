import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { getDb } from '@/server/db'
import { resolveImages, type ResolvedImage } from '@/server/media'

// Pieces every block renderer shares: the section heading, the call to
// action and image lookup by media key.

export type BlockContext = { pageSlug: string; vars: Record<string, string | number>; headingLevel: 1 | 2 }

export async function lookupImages(keys: string[]): Promise<Map<string, ResolvedImage>> {
  const wanted = keys.filter(Boolean)
  return wanted.length ? resolveImages(getDb(), wanted) : new Map()
}

const isExternal = (href: string) => /^(https?:|mailto:)/i.test(href)

/** A link from the panel: site paths go through next/link, the rest are plain anchors. */
export function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function CtaButton({ label, href, variant = 'primary', size = 'md', className = '' }: { label: string; href: string; variant?: 'primary' | 'secondary' | 'inverse'; size?: 'md' | 'lg'; className?: string }) {
  if (!label || !href) return null
  return (
    <SmartLink href={href} className={buttonClasses(variant, size, className)}>
      {label}
      {variant !== 'secondary' && <ArrowRight size={18} />}
    </SmartLink>
  )
}

export function TextLink({ label, href }: { label: string; href: string }) {
  if (!label || !href) return null
  return (
    <SmartLink href={href} className="inline-flex items-center gap-2 text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
      {label} <ArrowRight size={16} />
    </SmartLink>
  )
}

export function SectionHeader({ id, eyebrow, title, text, link, center = false }: { id?: string; eyebrow?: string; title?: string; text?: string; link?: ReactNode; center?: boolean }) {
  if (!eyebrow && !title && !text && !link) return null
  return (
    <div className={`flex flex-col gap-4 md:flex-row md:items-end ${center ? 'items-center text-center md:flex-col md:items-center' : 'justify-between'}`}>
      <div className={`max-w-2xl ${center ? 'mx-auto' : ''}`}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && (
          <h2 id={id} className={`font-display text-display-md text-balance ${eyebrow ? 'mt-3' : ''}`}>
            {title}
          </h2>
        )}
        {text && <p className="mt-4 whitespace-pre-line text-lede text-ink-soft">{text}</p>}
      </div>
      {link}
    </div>
  )
}

/** Splits a "line one\nline two" text into paragraphs. */
export function Lines({ text, className = '' }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .filter(Boolean)
        .map((l, i) => (
          <p key={i} className={`${i ? 'mt-3' : ''} ${className}`}>
            {l}
          </p>
        ))}
    </>
  )
}
