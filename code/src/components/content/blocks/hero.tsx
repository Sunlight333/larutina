import type { BlockDataMap } from '@/server/services/content/blocks'
import { ArrowRight, Check, Clock, FaceScan, Sparkle } from '@/components/icons'
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

  const notes = data.note ? data.note.split(/\s+·\s+/).filter(Boolean) : []
  const step = (n: number) => ({ animationDelay: `${n * 90}ms` })

  return (
    // The header is sticky and translucent: on the first block the photo starts under it.
    <section className={`relative ${ctx.first ? '-mt-16 lg:-mt-[6.5rem]' : ''}`}>
      <HeroCarousel slides={slides}>
        {data.eyebrow && (
          <p style={step(0)} className="animate-rise inline-flex items-center gap-2.5 rounded-full bg-paper py-1.5 pl-1.5 pr-4 text-[0.9375rem] font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-line">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]">
              <FaceScan size={18} />
            </span>
            {data.eyebrow}
          </p>
        )}
        <Heading style={step(1)} className={`animate-rise font-display text-display-hero font-extrabold text-balance text-ink ${data.eyebrow ? 'mt-6' : ''}`}>
          {emphasis(data.title)}
        </Heading>
        {data.subtitle && (
          <p style={step(2)} className="animate-rise mt-6 max-w-lg whitespace-pre-line text-lede font-medium text-ink-soft">
            {data.subtitle}
          </p>
        )}
        {((data.cta1Label && data.cta1Href) || (data.cta2Label && data.cta2Href)) && (
          <div style={step(3)} className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {data.cta1Label && data.cta1Href && (
              <SmartLink href={data.cta1Href} className={buttonClasses('primary', 'lg', 'group/cta w-full pl-2.5 sm:w-auto')}>
                <span className="grid size-10 place-items-center rounded-full bg-paper/15 ring-1 ring-paper/20">
                  <FaceScan size={22} />
                </span>
                {data.cta1Label}
                <ArrowRight size={20} className="transition-transform duration-300 group-hover/cta:translate-x-1" />
              </SmartLink>
            )}
            {data.cta2Label && data.cta2Href && (
              <SmartLink href={data.cta2Href} className={buttonClasses('secondary', 'lg', 'w-full border-ink/15 bg-paper/80 backdrop-blur sm:w-auto')}>
                {data.cta2Label}
              </SmartLink>
            )}
          </div>
        )}
        {notes.length > 0 && (
          <ul style={step(4)} className="animate-rise mt-7 flex flex-wrap gap-2.5" aria-label="Sobre el diagnóstico">
            {notes.map((part, i) => {
              const NoteIcon = noteIcon(part)
              return (
                <li key={i} className="inline-flex items-center gap-2 rounded-full bg-paper/80 py-1.5 pl-1.5 pr-3.5 text-[0.9375rem] font-semibold text-ink-soft ring-1 ring-line">
                  <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <NoteIcon size={16} />
                  </span>
                  {part}
                </li>
              )
            })}
          </ul>
        )}
      </HeroCarousel>
      <Curve className="absolute inset-x-0 -bottom-px z-[4] text-paper" />
    </section>
  )
}

/** The icon of a hero note: a clock for the time it takes, a check for the rest. */
function noteIcon(text: string) {
  const t = text.toLowerCase()
  if (/minut|segund|hora/.test(t)) return Clock
  if (/gratis|sin cargo/.test(t)) return Sparkle
  return Check
}

/**
 * "Tu rutina, pensada para *tu* piel": the words between asterisks in the
 * accent colour, underlined by the terracotta stroke of the logo, drawn in
 * once the page loads.
 */
export function emphasis(title: string) {
  return title.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
      <span key={i} className="relative inline-block whitespace-nowrap text-accent-ink">
        {part.slice(1, -1)}
        <svg aria-hidden="true" viewBox="0 0 200 16" preserveAspectRatio="none" className="absolute -bottom-[0.1em] left-[-2%] h-[0.2em] w-[104%] text-accent">
          <path d="M3 12 C 55 3, 140 2, 197 9" pathLength={1} className="animate-draw" fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" />
        </svg>
      </span>
    ) : (
      part
    ),
  )
}
