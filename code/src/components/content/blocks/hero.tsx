import type { BlockDataMap } from '@/server/services/content/blocks'
import { ArrowRight, FaceScan } from '@/components/icons'
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel'
import { buttonClasses } from '@/components/ui/button'
import { Curve } from '@/components/ui/curve'
import { lifestyleImage, type LifestyleName } from '@/lib/images'
import { lookupImages, SmartLink, type BlockContext } from './shared'

// CMS-01, H-01: the campaign hero of the approved design. The text comes
// from the panel. With a photo uploaded in the block (desktop and mobile
// versions, and their focal points) the hero shows that photo; without one
// it shows the campaign's three photographs, crossfading. On phones the
// photo sits above the text (never text over a face).

const CAMPAIGNS: { image: LifestyleName; title: string; alt: string; focus: HeroSlide['focus'] }[] = [
  {
    image: 'hero-1',
    title: 'Luminosidad',
    alt: 'Tres amigas con la piel luminosa junto a una ventana soleada, cada una con un producto de su rutina.',
    focus: { tablet: [0.94, 0.5], desktop: [0.62, 0.3] },
  },
  {
    image: 'hero-2',
    title: 'Hidratación',
    alt: 'Las mismas tres amigas se ríen en un sillón, cada una con su sérum o su crema.',
    focus: { tablet: [1, 0.5], desktop: [0.62, 0.3] },
  },
  {
    image: 'hero-3',
    title: 'Reparación',
    alt: 'Las tres amigas bajo un arco con la luz de la tarde, con los productos de su rutina de noche.',
    focus: { tablet: [0.94, 0.5], desktop: [0.62, 0.3] },
  },
]

function campaignSlides(): HeroSlide[] {
  return CAMPAIGNS.map((c) => {
    const img = lifestyleImage(c.image)
    const phone = lifestyleImage(`${c.image}-phone`)
    return {
      src: img.src,
      width: img.width,
      height: img.height,
      phone: { src: phone.src, width: phone.width, height: phone.height, crop: phone.crop ?? { left: 0, width: 1 } },
      alt: c.alt,
      title: c.title,
      focus: c.focus,
    }
  })
}

export async function HeroBlock({ data, ctx }: { data: BlockDataMap['hero']; ctx: BlockContext }) {
  const imgs = await lookupImages([data.imageDesktop, data.imageMobile])
  const desktop = imgs.get(data.imageDesktop) ?? imgs.get(data.imageMobile)
  const mobile = imgs.get(data.imageMobile) ?? desktop
  const Heading = ctx.headingLevel === 1 ? 'h1' : 'h2'
  const focus: [number, number] = [data.focusDesktop.x / 100, data.focusDesktop.y / 100]

  const slides: HeroSlide[] =
    desktop && mobile
      ? [
          {
            src: desktop.src,
            width: desktop.width,
            height: desktop.height,
            phone: { src: mobile.src, width: mobile.width, height: mobile.height, crop: { left: 0, width: 1 } },
            alt: data.imageAlt || desktop.alt || '',
            title: '',
            focus: { tablet: focus, desktop: focus },
          },
        ]
      : ctx.pageSlug === 'inicio'
        ? campaignSlides()
        : campaignSlides().slice(1, 2)

  return (
    // The header is sticky and translucent: on the first block the photo starts under it.
    <section className={`relative ${ctx.first ? '-mt-16 lg:-mt-[6.5rem]' : ''}`}>
      <HeroCarousel slides={slides}>
        <div className="animate-rise">
          {data.eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full bg-paper/85 py-1.5 pl-1.5 pr-3.5 text-[0.8125rem] font-medium ring-1 ring-ink/5">
              <span className="grid size-6 place-items-center rounded-full bg-accent text-paper">
                <FaceScan size={14} />
              </span>
              {data.eyebrow}
            </p>
          )}
          <Heading className={`font-display text-display-hero text-balance ${data.eyebrow ? 'mt-5' : ''}`}>{emphasis(data.title)}</Heading>
          {data.subtitle && <p className="mt-5 max-w-md whitespace-pre-line text-lede text-ink-soft">{data.subtitle}</p>}
          {((data.cta1Label && data.cta1Href) || (data.cta2Label && data.cta2Href)) && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {data.cta1Label && data.cta1Href && (
                <SmartLink href={data.cta1Href} className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
                  {data.cta1Label}
                  <ArrowRight size={18} />
                </SmartLink>
              )}
              {data.cta2Label && data.cta2Href && (
                <SmartLink href={data.cta2Href} className={buttonClasses('secondary', 'lg', 'w-full border-ink/15 bg-paper/75 sm:w-auto')}>
                  {data.cta2Label}
                </SmartLink>
              )}
            </div>
          )}
          {data.note && (
            <p className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              {data.note.split(/\s+·\s+/).map((part, i) => (
                <span key={i} className="inline-flex items-center gap-2.5">
                  {i > 0 && (
                    <span className="text-line-strong" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </HeroCarousel>
      <Curve className="absolute inset-x-0 -bottom-px z-[4] text-paper" />
    </section>
  )
}

/** "Tu rutina, pensada para *tu* piel": the words between asterisks in italic. */
export function emphasis(title: string) {
  return title.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
      <span key={i} className="italic">
        {part.slice(1, -1)}
      </span>
    ) : (
      part
    ),
  )
}
