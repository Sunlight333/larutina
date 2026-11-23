import { getImageProps } from 'next/image'
import type { CSSProperties } from 'react'
import type { BlockDataMap } from '@/server/services/content/blocks'
import type { Focal } from '@/server/services/content/fields'
import { CtaButton, lookupImages, type BlockContext } from './shared'

// CMS-01, H-01: each banner has a desktop and a mobile image. On phones the
// photo sits above the text (never text over a face) with its own 4:5 crop;
// from tablets up the wide photo fills the band with the text beside it. The
// focal point keeps the chosen part of the photo in view at any width.

const pos = (f: Focal) => `${f.x}% ${f.y}%`

export async function HeroBlock({ data, ctx }: { data: BlockDataMap['hero']; ctx: BlockContext }) {
  const imgs = await lookupImages([data.imageDesktop, data.imageMobile])
  const desktop = imgs.get(data.imageDesktop) ?? imgs.get(data.imageMobile)
  const mobile = imgs.get(data.imageMobile) ?? desktop
  const Heading = ctx.headingLevel === 1 ? 'h1' : 'h2'

  const text = (
    <div className="max-w-xl">
      {data.eyebrow && <p className="eyebrow">{data.eyebrow}</p>}
      <Heading className={`font-display text-display-hero text-balance ${data.eyebrow ? 'mt-4' : ''}`}>{data.title}</Heading>
      {data.subtitle && <p className="mt-5 max-w-md whitespace-pre-line text-lede text-ink-soft">{data.subtitle}</p>}
      {(data.cta1Label || data.cta2Label) && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaButton label={data.cta1Label} href={data.cta1Href} size="lg" className="w-full sm:w-auto" />
          <CtaButton label={data.cta2Label} href={data.cta2Href} variant="secondary" size="lg" className="w-full bg-paper/80 sm:w-auto" />
        </div>
      )}
      {data.note && <p className="mt-4 text-sm text-ink-muted">{data.note}</p>}
    </div>
  )

  if (!desktop || !mobile) {
    return (
      <section className="bg-shell">
        <div className="container-page py-16 md:py-24">{text}</div>
      </section>
    )
  }

  const alt = data.imageAlt || desktop.alt || ''
  const { props: desktopProps } = getImageProps({ src: desktop.src, width: desktop.width, height: desktop.height, alt, sizes: '100vw' })
  const { props: mobileProps } = getImageProps({ src: mobile.src, width: mobile.width, height: mobile.height, alt, sizes: '100vw' })
  const style = { '--pos-m': pos(data.focusMobile), '--pos-d': pos(data.focusDesktop) } as CSSProperties

  return (
    <section className="relative md:min-h-[34rem] lg:min-h-[40rem]">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand md:absolute md:inset-0 md:aspect-auto">
        <picture>
          <source media="(min-width: 48rem)" srcSet={desktopProps.srcSet} sizes="100vw" />
          <source srcSet={mobileProps.srcSet} sizes="100vw" />
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from the props */}
          <img
            {...mobileProps}
            loading="eager"
            fetchPriority="high"
            style={style}
            className="absolute inset-0 h-full w-full object-cover [object-position:var(--pos-m)] md:[object-position:var(--pos-d)]"
          />
        </picture>
        <div className="absolute inset-0 hidden bg-linear-to-r from-paper/90 via-paper/55 via-40% to-paper/0 to-70% md:block" />
      </div>
      <div className="relative md:flex md:min-h-[34rem] md:items-center lg:min-h-[40rem]">
        <div className="container-page py-10 md:py-16">{text}</div>
      </div>
    </section>
  )
}
