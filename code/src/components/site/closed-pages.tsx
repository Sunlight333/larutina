import Image from 'next/image'
import { getSettings } from '@/server/settings'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { copy } from '@/server/services/site'
import { whatsappLink } from '@/lib/whatsapp'
import { Wordmark } from '@/components/site/wordmark'
import { SignupForm } from '@/components/site/signup-form'
import { joinWaitlist } from '@/app/(site)/actions'
import { WAITLIST_CONSENT } from '@/lib/consent'

// G-25: "Próximamente" with the waitlist, shown for every route until launch.
export async function WaitlistPage() {
  const s = await getSettings()
  const image = s['copy.waitlistImage'] ? (await resolveImages(getDb(), [s['copy.waitlistImage']])).get(s['copy.waitlistImage']) : undefined
  return (
    <main id="contenido" className="grid min-h-dvh md:grid-cols-2">
      <section className="flex flex-col justify-between gap-12 px-6 py-10 md:px-12 md:py-14">
        <Wordmark name={s['brand.name']} />
        <div className="max-w-md">
          <h1 className="font-display text-display-lg text-balance">{await copy(s['copy.waitlistTitle'])}</h1>
          <p className="mt-5 text-lede text-ink-soft">{await copy(s['copy.waitlistText'])}</p>
          <div className="mt-8">
            <SignupForm action={joinWaitlist} consent={WAITLIST_CONSENT} button="Avisarme" />
          </div>
        </div>
        <p className="text-sm text-ink-muted">© {new Date().getFullYear()} {s['brand.fullName']}</p>
      </section>
      <div className="relative hidden bg-shell md:block">
        {image && <Image src={image.src} alt={image.alt ?? ''} fill priority sizes="50vw" className="object-cover" />}
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
        <Wordmark name={s['brand.name']} />
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
