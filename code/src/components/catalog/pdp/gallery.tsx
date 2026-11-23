'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ProductPlaceholder, stepTint } from '../product-image'

export type GalleryImage = { src: string; width: number; height: number; alt: string }
export type GalleryVideo = { kind: 'file' | 'embed'; src: string }

// F-02, CAT-17: 4:5 photos with the video as the last item; sticky on
// desktop (the page sets that). Thumbnails are buttons, so the gallery works
// with the keyboard; the main image is the LCP and loads first.
export function Gallery({ images, video, name, step, brand }: { images: GalleryImage[]; video: GalleryVideo | null; name: string; step: string; brand: string }) {
  const items = [...images.map((img) => ({ type: 'image' as const, img })), ...(video ? [{ type: 'video' as const, video }] : [])]
  const [index, setIndex] = useState(0)
  const current = items[index]

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)]" style={{ backgroundColor: stepTint(step) }}>
        {!current && <ProductPlaceholder step={step} label={brand} />}
        {current?.type === 'image' && (
          <Image
            key={current.img.src}
            src={current.img.src}
            alt={current.img.alt}
            fill
            sizes="(min-width: 64rem) 36rem, 100vw"
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : undefined}
            className="object-cover"
          />
        )}
        {current?.type === 'video' &&
          (current.video.kind === 'embed' ? (
            <iframe
              src={current.video.src}
              title={`Video de ${name}`}
              className="absolute inset-0 size-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video src={current.video.src} controls playsInline preload="metadata" className="absolute inset-0 size-full object-cover" aria-label={`Video de ${name}`} />
          ))}
      </div>

      {items.length > 1 && (
        <ul className="scroller mt-3 flex gap-2 overflow-x-auto" aria-label="Fotos y video">
          {items.map((it, i) => (
            <li key={i} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? 'true' : undefined}
                aria-label={it.type === 'video' ? 'Ver el video' : `Ver la foto ${i + 1} de ${images.length}`}
                className={`relative block aspect-[4/5] w-16 overflow-hidden rounded-lg border-2 sm:w-20 ${i === index ? 'border-ink' : 'border-transparent opacity-80 hover:opacity-100'}`}
              >
                {it.type === 'image' ? (
                  <Image src={it.img.src} alt="" fill sizes="5rem" className="object-cover" />
                ) : (
                  <span className="grid size-full place-items-center bg-night-deep text-paper">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
