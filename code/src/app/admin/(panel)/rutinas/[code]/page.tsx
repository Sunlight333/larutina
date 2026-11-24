import { notFound } from 'next/navigation'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { routineWarnings } from '@/server/services/admin/routines'
import { Card, Notice, PageHeader } from '@/components/admin/ui'
import { RoutineForm } from '../routine-form'

export const metadata = { title: 'Rutina' }

export default async function RoutineAdminPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin('catalog.edit')
  const { code } = await params
  const db = getDb()
  const r = await db.routine.findUnique({
    where: { code },
    include: {
      skinTypes: { include: { skinType: { select: { code: true } } } },
      concerns: { include: { concern: { select: { code: true } } } },
      steps: { orderBy: { position: 'asc' }, include: { mainProduct: { select: { code: true } }, alternatives: { orderBy: { position: 'asc' }, include: { product: { select: { code: true } } } } } },
    },
  })
  if (!r || r.deletedAt) notFound()
  const [skinTypes, concerns, warnings] = await Promise.all([db.skinType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }), db.concern.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }), routineWarnings(db, r.id)])
  return (
    <>
      <PageHeader title={r.name} back={{ href: '/rutinas', label: 'Rutinas armadas' }} />
      {warnings.length > 0 && (
        <div className="mb-6">
          <Notice tone="warning" title="Avisos de esta rutina (RUT-05, RUT-06)">
            <ul className="list-disc space-y-1 pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
      <Card>
        <RoutineForm
          skinTypes={skinTypes}
          concerns={concerns}
          routine={{
            code: r.code,
            name: r.name,
            goal: r.goal,
            moment: r.moment,
            difficulty: r.difficulty,
            discountPct: r.discountPct,
            discountHalves: r.discountHalves,
            description: r.description,
            status: r.status,
            skinTypes: r.skinTypes.map((s) => s.skinType.code),
            concerns: r.concerns.map((c) => c.concern.code),
            steps: r.steps.map((s) => ({ moment: s.moment, stepType: s.stepType, title: s.title, mainProduct: s.mainProduct.code, alternatives: s.alternatives.map((a) => a.product.code), instruction: s.instruction, frequency: s.frequency, optional: s.optional })),
          }}
        />
      </Card>
    </>
  )
}
