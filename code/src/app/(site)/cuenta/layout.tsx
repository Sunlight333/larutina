import type { Metadata } from 'next'

// CU-21: no account page is indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children
}
