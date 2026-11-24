import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Heart, User } from '@/components/icons'
import { AuthHeading } from '@/components/account/auth-heading'
import { SignInForm } from '@/components/account/auth-forms'
import { getDb } from '@/server/db'
import { currentCustomer } from '@/server/customers/session'
import { saveFavorite } from '@/server/customers/history'
import { safeReturnPath, signInHref } from '@/lib/return-path'
import { backParams, type SearchParams } from '@/components/account/params'

export const metadata: Metadata = { title: 'Ingresá' } // CU-21

// CU-01, CU-02. With "guardar", she came from a product's heart (F-08):
// it is saved as soon as she is in (PDP-09).
export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const back = backParams(await searchParams)
  const customer = await currentCustomer()
  if (customer) {
    if (back.save) await saveFavorite(getDb(), customer.id, back.save)
    redirect(safeReturnPath(back.returnTo))
  }
  return (
    <>
      <AuthHeading icon={<User size={28} />} title="Ingresá a tu cuenta" />
      {back.save && (
        <p className="-mt-2 mb-6 flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-[0.9375rem] font-medium text-accent-ink">
          <Heart size={20} filled className="shrink-0" />
          Ingresá para guardar tus favoritos.
        </p>
      )}
      <SignInForm back={back} createHref={signInHref(back.returnTo, { save: back.save ?? undefined, page: 'crear' })} />
    </>
  )
}
