import { Badge } from '@/components/admin/ui'

// Draft and published state of a page or article (ADM-02).
export function PageStatusBadge({ status, female = true }: { status: 'draft' | 'published' | 'changes'; female?: boolean }) {
  if (status === 'draft') return <Badge>Sin publicar</Badge>
  if (status === 'changes') return <Badge tone="warning">Cambios sin publicar</Badge>
  return <Badge tone="success">{female ? 'Publicada' : 'Publicado'}</Badge>
}
