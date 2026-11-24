import Image from 'next/image'
import { lifestyleImage } from '@/lib/images'

// The sign-in screens (CU-01 to CU-05): the form on a card over the linen
// band, a campaign portrait in an arch beside it from tablets up.
export default function AccessLayout({ children }: { children: React.ReactNode }) {
  const img = lifestyleImage('manana')
  return (
    <div className="tex-linen relative overflow-hidden bg-shell">
      <div className="container-page grid items-center gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:py-16 lg:gap-20 lg:py-20">
        <div className="animate-rise mx-auto w-full max-w-[30rem] rounded-[1.5rem_3rem_1.5rem_3rem] bg-paper p-6 shadow-[var(--shadow-lift)] ring-1 ring-line/70 sm:p-9 md:mx-0 md:justify-self-end">
          {children}
        </div>
        <div aria-hidden="true" className="relative hidden md:block">
          <div className="shape-arch relative mx-auto aspect-[4/5] max-w-[24rem] overflow-hidden bg-sand shadow-[var(--shadow-float)]">
            <Image src={img.src} alt="" fill sizes="384px" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
          </div>
          <span className="absolute -bottom-6 left-[8%] size-24 rounded-full bg-accent-soft/90 ring-1 ring-accent/20 lg:left-[14%]" />
        </div>
      </div>
    </div>
  )
}
