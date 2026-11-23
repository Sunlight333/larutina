import { LogoFull } from '@/components/site/logo'

export const metadata = { title: 'Ingresar al panel', robots: { index: false, follow: false } }

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-shell px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull priority className="w-64" />
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">{children}</div>
      </div>
    </main>
  )
}
