import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Lock } from '@/components/icons'
import { AuthHeading } from '@/components/account/auth-heading'
import { ResetRequestForm } from '@/components/account/auth-forms'

export const metadata: Metadata = { title: 'Ingresá' } // CU-21: part of signing in

// CU-04.
export default function ResetRequestPage() {
  return (
    <>
      <AuthHeading icon={<Lock size={28} />} title="¿Olvidaste tu contraseña?">
        <p>Escribí tu email y te mandamos un link para crear una nueva.</p>
      </AuthHeading>
      <ResetRequestForm />
      <p className="mt-6 text-center">
        <Link href="/cuenta/ingresar" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={18} />
          Ingresar
        </Link>
      </p>
    </>
  )
}
