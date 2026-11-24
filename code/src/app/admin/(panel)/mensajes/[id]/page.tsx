import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { STATUS_LABELS } from '@/server/services/content/contact'
import { AdminForm } from '@/components/admin/form'
import { Select, TextArea } from '@/components/admin/fields'
import { Card, DefinitionList, PageHeader, formatDateTime } from '@/components/admin/ui'
import { updateMessageAction } from '../actions'
import { MessageStatusBadge } from '../status'

export const metadata = { title: 'Mensaje' }

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('messages.view')
  const { id } = await params
  const m = await getDb().contactMessage.findUnique({ where: { id } })
  if (!m) notFound()
  const subject = encodeURIComponent(`Re: ${m.reason}`)
  return (
    <>
      <PageHeader title={m.name} description={<MessageStatusBadge status={m.status} />} back={{ href: '/mensajes', label: 'Mensajes' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <DefinitionList
              items={[
                ['Recibido', formatDateTime(m.createdAt)],
                ['Motivo', m.reason],
                [
                  'Email',
                  <a key="e" href={`mailto:${m.email}?subject=${subject}`} className="underline underline-offset-2">
                    {m.email}
                  </a>,
                ],
                ['Teléfono', m.phone],
                ['N° de pedido', m.orderNumber],
              ]}
            />
            <p className="mt-5 whitespace-pre-wrap border-t border-line pt-5 text-sm leading-relaxed">{m.message}</p>
          </Card>
          {m.attachments.length > 0 && (
            <Card title="Fotos" description="Privadas: solo se ven desde el panel y cada vista queda registrada.">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {m.attachments.map((_key, i) => (
                  <li key={i}>
                    <a href={`/adjuntos/${m.id}/${i}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-line bg-shell">
                      {/* A plain img: the image optimizer would fetch without the admin session. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/adjuntos/${m.id}/${i}`} alt={`Foto ${i + 1} adjunta`} className="aspect-square w-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card title="Seguimiento">
          <AdminForm action={updateMessageAction.bind(null, m.id)}>
            <Select name="status" label="Estado" defaultValue={m.status} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            <TextArea name="note" label="Nota interna" defaultValue={m.note} rows={5} help="Solo la ve el equipo." />
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
