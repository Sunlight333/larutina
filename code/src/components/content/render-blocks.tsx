import type { ReactNode } from 'react'
import { fillVariables } from '@/lib/copy-variables'
import { markdownToText } from '@/lib/markdown'
import { getCopyVariables } from '@/server/services/site'
import { fillBlocks, type Block, type BlockType, type PageDoc } from '@/server/services/content/blocks'
import { JsonLd } from './json-ld'
import { HeroBlock } from './blocks/hero'
import { AmbassadorsBlock, CarouselBlock, DiagnosisBlock, FaqBlock, FeaturesBlock, HowItWorksBlock, ImageTextBlock, NewsletterBlock, RichTextBlock, TestimonialsBlock } from './blocks/sections'
import { BrandsBlock, FeaturedBlock, NeedsBlock, RoutinesBlock } from './blocks/catalog-blocks'
import type { BlockContext } from './blocks/shared'

// The renderer half of the block registry (the schema half is
// src/server/services/content/blocks.ts). The Record type makes a new block
// type fail to compile until it has a renderer.

type Renderer<T extends BlockType> = (props: { data: Extract<Block, { type: T }>['data']; ctx: BlockContext }) => ReactNode | Promise<ReactNode>

const RENDERERS: { [T in BlockType]: Renderer<T> } = {
  hero: HeroBlock,
  carousel: CarouselBlock,
  features: FeaturesBlock,
  needs: NeedsBlock,
  imageText: ImageTextBlock,
  diagnosis: DiagnosisBlock,
  routines: RoutinesBlock,
  featured: FeaturedBlock,
  howItWorks: HowItWorksBlock,
  richText: RichTextBlock,
  faq: FaqBlock,
  testimonials: TestimonialsBlock,
  ambassadors: AmbassadorsBlock,
  brands: BrandsBlock,
  newsletter: NewsletterBlock,
}

function renderBlock(block: Block, ctx: BlockContext) {
  const Component = RENDERERS[block.type] as Renderer<BlockType>
  return <Component key={block.id} data={block.data} ctx={ctx} />
}

/** One FAQPage for every question on the page (CMS-03: rich results for the FAQ). */
function faqJsonLd(blocks: Block[]) {
  const items = blocks.flatMap((b) => (b.type === 'faq' ? b.data.items : []))
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: markdownToText(i.answer) } })),
  }
}

/**
 * A whole block page. The Home's hero carries the h1; on other pages the
 * title is the h1 unless the page starts with a hero.
 */
export async function PageView({ doc, slug, isHome, preview }: { doc: PageDoc; slug: string; isHome: boolean; preview: boolean }) {
  const vars = await getCopyVariables()
  const fill = (s: string) => fillVariables(s, vars)
  const blocks = fillBlocks(doc.blocks, fill)
  const startsWithHero = blocks[0]?.type === 'hero'
  const showTitle = !isHome && !startsWithHero
  const faq = faqJsonLd(blocks)
  return (
    <>
      {preview && (
        <p role="status" className="bg-accent-soft px-4 py-2 text-center text-sm text-accent-ink">
          Vista previa del borrador: así se va a ver al publicar. Las visitas siguen viendo la versión publicada.
        </p>
      )}
      {showTitle && (
        <header className="container-page pb-2 pt-12 md:pt-16">
          <h1 className="max-w-3xl font-display text-display-lg text-balance">{fill(doc.title)}</h1>
        </header>
      )}
      {/* Every page keeps one h1, even a Home whose first block is not the hero. */}
      {isHome && !startsWithHero && <h1 className="sr-only">{fill(doc.title)}</h1>}
      {blocks.map((b, i) => renderBlock(b, { pageSlug: slug, vars, headingLevel: i === 0 && b.type === 'hero' ? 1 : 2 }))}
      {faq && <JsonLd data={faq} />}
    </>
  )
}
