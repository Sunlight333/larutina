import { getImageProps } from 'next/image'
import type { CSSProperties } from 'react'
import type { BlockDataMap } from '@/server/services/content/blocks'
import type { Focal } from '@/server/services/content/fields'
import { CtaButton, lookupImages, type BlockContext } from './shared'
import { LogoMark } from '@/components/site/logo'

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

  // No photo yet: the brand's emblem carries the band, large, over a soft
  // terracotta sun, so the Home reads as finished before the shoot arrives.
  if (!desktop || !mobile) {
    return (
      <section className="relative overflow-hidden bg-shell">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:py-20 lg:py-24">
          {text}
          <div aria-hidden="true" className="relative mx-auto grid w-full max-w-[17rem] place-items-center md:max-w-[26rem] lg:max-w-[30rem]">
            <span className="absolute inset-[-12%] rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)]" />
            <span className="absolute inset-[4%] rounded-full border border-line-strong/60" />
            <span className="relative grid aspect-square w-[84%] place-items-center rounded-full bg-paper p-[4%] shadow-[0_40px_80px_-40px_rgb(62_44_34/0.55)] ring-1 ring-line">
              <LogoMark className="size-full" priority sizes="(min-width: 1024px) 420px, (min-width: 768px) 360px, 240px" />
            </span>
          </div>
        </div>
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
