import Image from 'next/image'
import { getSettings } from '@/server/settings'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { copy } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'
import { LogoFull, LogoMark } from '@/components/site/logo'
import { SignupForm } from '@/components/site/signup-form'
import { joinWaitlist } from '@/app/(site)/actions'
import { WAITLIST_CONSENT } from '@/lib/consent'
import { WAITLIST_JOINED } from '@/lib/waitlist'
import { lifestyleImage } from '@/lib/images'

// G-25: "Próximamente" with the waitlist, shown for every route until launch.
// The full logo leads, large and centred; from desktop the page splits in
// two with the waitlist image of the panel on the right, or the campaign's.
export async function WaitlistPage() {
  const s = await getSettings()
  const own = s['copy.waitlistImage'] ? (await resolveImages(getDb(), [s['copy.waitlistImage']])).get(s['copy.waitlistImage']) : undefined
  const campaign = lifestyleImage('hero-2-phone')
  const image = own ?? { src: campaign.src, alt: '' }
  return (
    <main id="contenido" className="relative grid min-h-dvh overflow-hidden bg-paper lg:grid-cols-2">
      {/* Soft terracotta sun behind the logo, from the emblem. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)]" />
      <section className="relative flex flex-col items-center justify-between gap-10 px-6 py-10 text-center md:py-14">
        <span aria-hidden="true" />
        <div className="flex max-w-xl flex-col items-center">
          <h1 className="sr-only">{s['brand.fullName']}</h1>
          <LogoFull priority className="w-[min(86vw,32rem)]" />
          <div aria-hidden="true" className="mt-10 h-px w-24 bg-gradient-to-r from-transparent via-accent to-transparent" />
          <p className="mt-8 font-display text-display-md text-balance">{await copy(s['copy.waitlistTitle'])}</p>
          <p className="mt-4 max-w-md text-lede text-ink-soft">{await copy(s['copy.waitlistText'])}</p>
          <div className="mt-8 w-full max-w-md text-left">
            <SignupForm action={joinWaitlist} consent={WAITLIST_CONSENT} button="Avisarme" rememberAs={WAITLIST_JOINED} />
          </div>
        </div>
        <p className="text-sm text-ink-muted">© {new Date().getFullYear()} {s['brand.fullName']}</p>
      </section>
      <div className="relative hidden p-4 lg:block">
        <div className="shape-leaf relative size-full overflow-hidden bg-sand">
          <Image src={image.src} alt={image.alt ?? ''} fill priority sizes="50vw" className="object-cover" />
        </div>
      </div>
    </main>
  )
}

// G-26. Shown to visitors while maintenance mode is on.
export async function MaintenancePage() {
  const s = await getSettings()
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp']) : null
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <LogoMark className="mx-auto size-36" priority alt={s['brand.fullName']} />
        <h1 className="mt-10 font-display text-display-md text-balance">{await copy(s['copy.maintenanceText'])}</h1>
        {wa && (
          <p className="mt-6 text-ink-soft">
            ¿Es urgente?{' '}
            <a href={wa} className="underline underline-offset-2">
              Escribinos por WhatsApp
            </a>
            .
          </p>
        )}
      </div>
    </main>
  )
}

// G-25 in the waitlist window (WaitlistModal): the same copy as the page,
// sized for a dialog.
export async function WaitlistModalContent() {
  const s = await getSettings()
  return (
    <div className="flex flex-col items-center text-center">
      <LogoFull className="w-[min(70vw,19rem)]" />
      <div aria-hidden="true" className="mt-7 h-px w-20 bg-gradient-to-r from-transparent via-accent to-transparent" />
      <h2 id="lista-de-espera-titulo" className="mt-6 font-display text-display-sm text-balance">
        {await copy(s['copy.waitlistTitle'])}
      </h2>
      <p className="mt-3 text-ink-soft">{await copy(s['copy.waitlistText'])}</p>
      <div className="mt-6 w-full text-left">
        <SignupForm action={joinWaitlist} consent={WAITLIST_CONSENT} button="Avisarme" rememberAs={WAITLIST_JOINED} />
      </div>
    </div>
  )
}
