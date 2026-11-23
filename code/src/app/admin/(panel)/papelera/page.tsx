import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { TRASH } from '@/server/trash'
import { Card, EmptyState, PageHeader, adminButton, formatDateTime } from '@/components/admin/ui'

export const metadata = { title: 'Papelera' }

async function restore(form: FormData) {
  'use server'
  const type = TRASH.find((t) => t.type === form.get('type'))
  if (!type) return
  const admin = await requireAdmin(type.permission)
  const id = String(form.get('id'))
  const db = getDb()
  await type.restore(db, id)
  await audit(db, admin, { action: 'restore', entityType: type.type, entityId: id, label: String(form.get('label') ?? '') })
  revalidatePath('/admin/papelera')
}

export default async function TrashPage() {
  const admin = await requireAdmin()
  const db = getDb()
  const sections = await Promise.all(TRASH.filter((t) => can(admin.role, t.permission)).map(async (t) => ({ t, rows: await t.list(db) })))
  const any = sections.some((s) => s.rows.length)
  return (
    <>
      <PageHeader title="Papelera" description="Lo que se borra desde el panel queda acá y se puede restaurar." />
      {!any && <EmptyState>La papelera está vacía.</EmptyState>}
      <div className="space-y-4">
        {sections
          .filter((s) => s.rows.length)
          .map(({ t, rows }) => (
            <Card key={t.type} title={t.label}>
              <ul className="divide-y divide-line text-sm">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {r.label} <span className="text-ink-muted">· borrado {formatDateTime(r.deletedAt)}</span>
                    </span>
                    <form action={restore}>
                      <input type="hidden" name="type" value={t.type} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="label" value={r.label} />
                      <button className={adminButton('secondary')}>Restaurar</button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      </div>
    </>
  )
}
