import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { loadSettings, SETTINGS, SETTING_GROUPS, type LinkItem } from '@/server/settings'
import type { SettingDef, SettingGroup } from '@/server/settings/registry'
import { resolveImages } from '@/server/media'
import { getPreviewToken } from '@/server/site-access'
import { VARIABLE_HELP } from '@/lib/copy-variables'
import { AdminForm } from '@/components/admin/form'
import { Checkbox, ImageField, LinesField, LinksField, MoneyField, TextArea, TextField } from '@/components/admin/fields'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { param, type SearchParams } from '@/components/admin/table'
import { rotatePreview, saveSettingsGroup } from './actions'
import { groupPermission } from './groups'

export const metadata = { title: 'Configuración' }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const groups = (Object.keys(SETTING_GROUPS) as SettingGroup[]).filter((g) => can(admin.role, groupPermission(g)))
  if (!groups.length) return <Notice tone="warning">Tu rol no tiene configuración para editar.</Notice>
  const group = (groups.find((g) => g === param(sp, 'grupo')) ?? groups[0])!
  const db = getDb()
  const values = (await loadSettings(db)) as Record<string, unknown>
  const defs = SETTINGS.filter((d) => d.group === group)
  const images = await resolveImages(db, defs.filter((d) => d.type === 'image').map((d) => String(values[d.key] ?? '')))
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const previewUrl = group === 'site' ? `${base}/vista-previa?t=${await getPreviewToken(db)}` : null

  return (
    <>
      <PageHeader title="Configuración" description="Datos que usa todo el sitio. Los cambios se ven apenas se guardan." />
      <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Secciones">
        {groups.map((g) => (
          <Link
            key={g}
            href={`/configuracion?grupo=${g}`}
            aria-current={g === group ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${g === group ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'}`}
          >
            {SETTING_GROUPS[g]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={saveSettingsGroup.bind(null, group)}>
            {defs.map((d) => (
              <SettingField key={d.key} def={d} value={values[d.key]} preview={images.get(String(values[d.key] ?? ''))?.src} disabled={!!d.adminOnly && admin.role !== 'ADMIN'} />
            ))}
          </AdminForm>
        </Card>
        <div className="space-y-4">
          {previewUrl && (
            <Card title="Link de vista previa" description="Abre el sitio completo mientras está en modo Próximamente o mantenimiento, sin cuenta.">
              <p className="break-all rounded-md bg-shell px-3 py-2 font-mono text-xs">{previewUrl}</p>
              <div className="mt-3">
                <AdminForm action={rotatePreview} submitLabel="Crear un link nuevo" className="space-y-3">
                  <p className="text-xs text-ink-muted">Crear uno nuevo desactiva el anterior.</p>
                </AdminForm>
              </div>
            </Card>
          )}
          {(group === 'copy' || group === 'navigation') && (
            <Card title="Variables en los textos">
              <ul className="space-y-1 text-sm">
                {Object.entries(VARIABLE_HELP).map(([k, v]) => (
                  <li key={k}>
                    <code className="rounded bg-shell px-1">{`{${k}}`}</code> {v}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function SettingField({ def, value, preview, disabled }: { def: SettingDef; value: unknown; preview?: string; disabled: boolean }) {
  const common = { name: def.key, label: def.label, help: disabled ? 'Solo el rol Administración puede cambiarlo.' : def.help, disabled }
  switch (def.type) {
    case 'boolean':
      return <Checkbox {...common} defaultChecked={!!value} />
    case 'number':
      return <TextField {...common} type="number" defaultValue={value as number} />
    case 'money':
      return <MoneyField {...common} defaultCents={value as number} />
    case 'textarea':
      return <TextArea {...common} defaultValue={value as string} rows={3} />
    case 'codes':
      return <LinesField {...common} defaultValues={value as string[]} />
    case 'links':
      return <LinksField {...common} defaultValue={value as LinkItem[]} />
    case 'image':
      return <ImageField {...common} defaultKey={value as string} previewUrl={preview} />
    case 'url':
      return <TextField {...common} type="url" defaultValue={value as string} />
    case 'email':
      return <TextField {...common} type="email" defaultValue={value as string} />
    default:
      return <TextField {...common} defaultValue={value as string} />
  }
}
