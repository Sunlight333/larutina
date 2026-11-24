import type { Metadata } from 'next'
import { Check, IconBadge } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { getSettings } from '@/server/settings'

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Mi ${(await getSettings())['brand.name']}` } // CU-21
}

// CU-17: the confirmation once the account is gone (the session already ended).
export default function AccountDeletedPage() {
  return (
    <div className="tex-linen bg-shell">
      <div className="container-page py-16 md:py-24">
        <div className="animate-rise mx-auto max-w-xl rounded-[1.5rem_3rem_1.5rem_3rem] bg-paper p-8 text-center shadow-[var(--shadow-lift)] ring-1 ring-line/70 sm:p-12">
          <IconBadge size="xl" tone="sage" className="mx-auto">
            <Check size={32} />
          </IconBadge>
          <p role="status" className="mt-6 font-display text-display-sm text-balance">
            Listo. Eliminamos tu cuenta. Te mandamos un email de confirmación.
          </p>
          <ButtonLink href="/" variant="secondary" size="lg" className="mt-8">
            Ir al inicio
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
