import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { EMAIL_TEMPLATES } from '@/server/email/templates'
import { emailProvider } from '@/server/email'
import { getSettings } from '@/server/settings'
import { DataTable } from '@/components/admin/table'
import { Badge, Card, Notice, PageHeader, formatDateTime } from '@/components/admin/ui'

export const metadata = { title: 'Emails' }

const STATUS = { QUEUED: 'En cola', SENT: 'Enviado', FAILED: 'Falló', SKIPPED: 'No enviado' } as const

// EML-01: one base design, the text of every email editable here; and the
// log of what went out.
export default async function EmailsPage() {
  await requireAdmin('emails.edit')
  const db = getDb()
  const [overrides, recent, s] = await Promise.all([db.emailTemplate.findMany({ select: { key: true, updatedAt: true, updatedBy: true } }), db.emailMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }), getSettings()])
  const provider = emailProvider()
  return (
    <>
      <PageHeader title="Emails" description="Una sola plantilla con el diseño de la marca; el texto de cada email se edita acá y cambia los próximos envíos." />
      {(!provider || !s['brand.senderEmail']) && (
        <div className="mb-6">
          <Notice tone="warning" title="Los emails todavía no salen">
            {!provider ? 'Falta conectar el proveedor de email (en el servidor). ' : ''}
            {!s['brand.senderEmail'] ? 'Falta el email remitente en Configuración → Marca. ' : ''}
            Mientras tanto, cada email queda en el registro de abajo para revisarlo.
          </Notice>
        </div>
      )}
      <div className="space-y-6">
        <Card title="Textos">
          <DataTable
            rows={EMAIL_TEMPLATES}
            rowKey={(t) => t.key}
            columns={[
              { key: 'n', label: 'Email', render: (t) => <Link href={`/emails/${t.key}`} className="font-medium underline-offset-2 hover:underline">{t.label}</Link> },
              { key: 'c', label: 'Fila', render: (t) => <span className="text-ink-muted">{t.code}</span> },
              {
                key: 's',
                label: 'Texto',
                render: (t) => {
                  const o = overrides.find((x) => x.key === t.key)
                  return o ? <Badge tone="info">Editado {formatDateTime(o.updatedAt)}{o.updatedBy ? ` por ${o.updatedBy}` : ''}</Badge> : <span className="text-ink-muted">Original</span>
                },
              },
            ]}
          />
        </Card>
        <Card title="Últimos emails">
          <DataTable
            rows={recent}
            rowKey={(m) => m.id}
            empty="Todavía no salió ninguno."
            columns={[
              { key: 'd', label: 'Cuándo', render: (m) => formatDateTime(m.sentAt ?? m.createdAt) },
              { key: 't', label: 'Para', render: (m) => m.to },
              { key: 's', label: 'Asunto', render: (m) => <Link href={`/emails/registro/${m.id}`} className="underline-offset-2 hover:underline">{m.subject}</Link> },
              { key: 'e', label: 'Estado', render: (m) => <Badge tone={m.status === 'SENT' ? 'success' : m.status === 'FAILED' ? 'danger' : 'neutral'}>{STATUS[m.status]}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
