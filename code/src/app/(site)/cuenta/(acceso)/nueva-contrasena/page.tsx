import type { Metadata } from 'next'
import { Lock } from '@/components/icons'
import { AuthHeading } from '@/components/account/auth-heading'
import { ExpiredLink, NewPasswordForm } from '@/components/account/auth-forms'
import { one, type SearchParams } from '@/components/account/params'
import { getDb } from '@/server/db'
import { resetLinkValid } from '@/server/customers/account'

export const metadata: Metadata = { title: 'Ingresá', referrer: 'no-referrer' } // CU-21; the link's token never leaves in a Referer

// CU-05: from the link in the email (EM-11), valid for one hour and one use.
export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const token = one((await searchParams).t)
  const valid = await resetLinkValid(getDb(), token)
  return (
    <>
      <AuthHeading icon={<Lock size={28} />} title="Creá una contraseña nueva" />
      {valid ? <NewPasswordForm token={token} /> : <ExpiredLink />}
    </>
  )
}
