import Image from 'next/image'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { mediaUrl, PRODUCT_IMAGE_MIN } from '@/server/media'
import { belowProductSize, formatBytes, listMedia, MAX_FILES_PER_UPLOAD } from '@/server/services/content/media-library'
import { AdminForm, SubmitButton } from '@/components/admin/form'
import { TextField } from '@/components/admin/fields'
import { CopyButton } from '@/components/admin/copy-button'
import { FilterBar, Pagination, pageOf, param, type SearchParams } from '@/components/admin/table'
import { Badge, Card, EmptyState, PageHeader, formatDate } from '@/components/admin/ui'
import { saveMediaAction, uploadMediaAction } from './actions'

export const metadata = { title: 'Imágenes' }

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export default async function MediaLibrary({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin('media.manage')
  const sp = await searchParams
  const { skip, take, page, size } = pageOf(sp, 24)
  const { rows, total } = await listMedia(getDb(), { q: param(sp, 'q')?.trim(), skip, take })
  return (
    <>
      <PageHeader
        title="Imágenes"
        description={`Las imágenes del sitio y del catálogo. Las de producto necesitan ${PRODUCT_IMAGE_MIN.width} × ${PRODUCT_IMAGE_MIN.height} o más (4:5); las más chicas se marcan.`}
      />
      <div className="space-y-6">
        <Card title="Subir imágenes" description={`JPG, PNG, WebP o AVIF, hasta 15 MB cada una y ${MAX_FILES_PER_UPLOAD} por vez. Para fotos de producto, usá el nombre de archivo de la columna imagenes de la planilla.`}>
          <AdminForm action={uploadMediaAction} submitLabel="Subir" resetOnSuccess>
            <div className="space-y-1.5">
              <label htmlFor="media-files" className="block text-sm font-medium">
                Archivos
              </label>
              <input id="media-files" name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="block text-sm" />
            </div>
          </AdminForm>
        </Card>

        <div>
          <FilterBar sp={sp} placeholder="Buscar por nombre de archivo o texto alternativo" />
          {rows.length === 0 ? (
            <EmptyState>{param(sp, 'q') ? 'No hay imágenes con esa búsqueda.' : 'Todavía no hay imágenes.'}</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((a) => {
                const url = mediaUrl(a.key)
                return (
                  <li key={a.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-paper">
                    <div className="relative aspect-square bg-shell">
                      <Image src={url} alt={a.alt ?? ''} fill sizes="(min-width: 80rem) 16rem, (min-width: 40rem) 45vw, 92vw" className="object-contain" />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                      <p className="break-all font-medium">{a.fileName}</p>
                      <p className="text-xs text-ink-muted">
                        {a.width && a.height ? `${a.width} × ${a.height} · ` : ''}
                        {formatBytes(a.size)} · {formatDate(a.createdAt)}
                      </p>
                      {belowProductSize(a) && <Badge tone="warning">Chica para producto</Badge>}
                      <div className="flex flex-wrap gap-1">
                        <CopyButton text={a.key} label="Copiar clave" />
                        <CopyButton text={`${siteUrl}${url}`} label="Copiar URL" />
                      </div>
                      <AdminForm
                        action={saveMediaAction.bind(null, a.id)}
                        className="mt-auto space-y-2"
                        submitLabel="Guardar"
                        extraButtons={
                          <SubmitButton name="intent" value="delete" variant="ghost" confirm={`¿Mandar "${a.fileName}" a la papelera? Si se usa en el sitio, deja de verse.`}>
                            Borrar
                          </SubmitButton>
                        }
                      >
                        <TextField name="alt" label="Texto alternativo" defaultValue={a.alt} maxLength={250} />
                      </AdminForm>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Pagination basePath="/medios" sp={sp} total={total} page={page} size={size} />
        </div>
      </div>
    </>
  )
}
