import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkle } from '@/components/icons'
import { AuthHeading } from '@/components/account/auth-heading'
import { RegisterForm } from '@/components/account/auth-forms'
import { backParams, type SearchParams } from '@/components/account/params'
import { currentCustomer } from '@/server/customers/session'
import { getLegalLinks } from '@/server/services/site'
import { safeReturnPath, signInHref } from '@/lib/return-path'

export const metadata: Metadata = { title: 'Creá tu cuenta' } // CU-21

// CU-03. The note for those coming from the diagnosis result arrives with the
// saved diagnosis (Phase 3).
export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const back = backParams(await searchParams)
  if (await currentCustomer()) redirect(safeReturnPath(back.returnTo))
  const legal = await getLegalLinks()
  const doc = (code: string, label: string) =>
    legal.some((d) => d.code === code) ? (
      <Link href={`/legales/${code}`} target="_blank" className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        {label}
      </Link>
    ) : (
      label
    )
  return (
    <>
      <AuthHeading icon={<Sparkle size={28} />} title="Creá tu cuenta" />
      <RegisterForm
        back={back}
        terms={
          <>
            Acepto los {doc('terminos', 'Términos')} y la {doc('privacidad', 'Política de privacidad')}
          </>
        }
      />
      <p className="mt-6 text-center text-[0.9375rem] text-ink-soft">
        ¿Ya tenés cuenta?{' '}
        <Link href={signInHref(back.returnTo, { save: back.save ?? undefined })} className="font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Ingresá
        </Link>
      </p>
    </>
  )
}
