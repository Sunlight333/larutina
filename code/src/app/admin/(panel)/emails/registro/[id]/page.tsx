import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { Card, DefinitionList, PageHeader, formatDateTime } from '@/components/admin/ui'

export const metadata = { title: 'Email enviado' }

export default async function SentEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('emails.edit')
  const { id } = await params
  const m = await getDb().emailMessage.findUnique({ where: { id } })
  if (!m) notFound()
  return (
    <>
      <PageHeader title={m.subject} back={{ href: '/emails', label: 'Emails' }} />
      <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
        <Card>
          <DefinitionList
            items={[
              ['Para', m.to],
              ['Creado', formatDateTime(m.createdAt)],
              ['Enviado', m.sentAt ? formatDateTime(m.sentAt) : '—'],
              ['Estado', m.status],
              ['Intentos', String(m.attempts)],
              ['Error', m.lastError ?? '—'],
            ]}
          />
        </Card>
        <Card>
          <iframe title="Email" srcDoc={m.html} sandbox="" className="h-[44rem] w-full rounded-lg border border-line bg-shell" />
        </Card>
      </div>
    </>
  )
}
