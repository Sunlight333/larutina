'use client'

import { useEffect, useState } from 'react'
import { Checkbox, ImageField, LinesField, Select, TextArea, TextField } from '@/components/admin/fields'
import { useFieldError } from '@/components/admin/form'
import { adminButton, Badge } from '@/components/admin/ui'
import type { FieldData, FieldDef, ListRow, ScalarField, ScalarValue, Focal } from '@/server/services/content/fields'
import type { BlockCatalog } from '@/server/services/content/blocks'

// The panel's block editor (CMS-01): add, remove, reorder and switch blocks
// on and off, and edit each block's fields with the generic admin fields.
// Order, type and on/off travel as JSON in `blocks`; each field is a normal
// input named `b.<id>.<field>`, so errors show next to their field.

type EditorBlock = { id: string; type: string; enabled: boolean; data: FieldData }

const newId = () => Math.random().toString(36).slice(2, 10)
const mediaUrl = (key: string) => `/media/${key.split('/').map(encodeURIComponent).join('/')}`
const MARKDOWN_HELP = 'Admite ## Título, ### Subtítulo, **negrita**, *cursiva*, [texto](/link), listas con "- " o "1. " y citas con "> ".'

export function BlockEditor({ catalog, initial }: { catalog: BlockCatalog; initial: EditorBlock[] }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initial)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(catalog[0]?.type ?? '')
  const blocksError = useFieldError('blocks')
  const byType = new Map(catalog.map((c) => [c.type as string, c]))

  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  const toggleOpen = (id: string, value?: boolean) =>
    setOpen((s) => {
      const next = new Set(s)
      if (value ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <div className="space-y-3">
      <input type="hidden" name="blocks" value={JSON.stringify(blocks.map(({ id, type, enabled }) => ({ id, type, enabled })))} />
      {blocksError && <p className="text-sm font-medium text-[oklch(0.5_0.17_25)]">{blocksError}</p>}
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">Todavía no hay bloques. Agregá el primero abajo.</p>}
      <ol className="space-y-3">
        {blocks.map((b, i) => {
          const def = byType.get(b.type)
          if (!def) return null
          return (
            <BlockCard
              key={b.id}
              index={i}
              total={blocks.length}
              block={b}
              label={def.label}
              description={def.description}
              fields={def.fields}
              open={open.has(b.id)}
              onOpen={(v) => toggleOpen(b.id, v)}
              onMove={(d) => move(i, d)}
              onToggle={(enabled) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, enabled } : x)))}
              onRemove={() => {
                if (window.confirm(`¿Quitar el bloque "${def.label}"? Se pierde al guardar.`)) setBlocks((bs) => bs.filter((x) => x.id !== b.id))
              }}
            />
          )
        })}
      </ol>
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-shell p-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium">Agregar un bloque</span>
          <select value={adding} onChange={(e) => setAdding(e.target.value)} className="h-10 w-full rounded-lg border border-line-strong bg-paper px-3 text-sm">
            {catalog.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={adminButton('secondary', 'h-10')}
          onClick={() => {
            const def = byType.get(adding)
            if (!def) return
            const id = newId()
            setBlocks((bs) => [...bs, { id, type: def.type, enabled: true, data: structuredClone(def.empty) }])
            toggleOpen(id, true)
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

function BlockCard({
  index,
  total,
  block,
  label,
  description,
  fields,
  open,
  onOpen,
  onMove,
  onToggle,
  onRemove,
}: {
  index: number
  total: number
  block: EditorBlock
  label: string
  description: string
  fields: FieldDef[]
  open: boolean
  onOpen: (v?: boolean) => void
  onMove: (d: -1 | 1) => void
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  const prefix = `b.${block.id}`
  const error = useFieldError(prefix)
  // A block with problems opens itself after a save, so its fields are seen.
  useEffect(() => {
    if (error) onOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])
  const summary = typeof block.data.title === 'string' && block.data.title ? block.data.title : ''
  return (
    <li className={`rounded-xl border bg-paper ${error ? 'border-[oklch(0.55_0.17_25)]' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => onOpen()} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-shell text-xs tabular-nums">{index + 1}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {label} {!block.enabled && <Badge>Oculto</Badge>} {error && <Badge tone="danger">Revisar</Badge>}
            </span>
            {summary && <span className="block truncate text-xs text-ink-muted">{summary}</span>}
          </span>
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={block.enabled} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-ink" />
          Visible
        </label>
        <button type="button" aria-label={`Subir el bloque ${index + 1}`} disabled={index === 0} onClick={() => onMove(-1)} className="rounded px-2 py-1 text-sm hover:bg-shell disabled:opacity-30">
          ↑
        </button>
        <button type="button" aria-label={`Bajar el bloque ${index + 1}`} disabled={index === total - 1} onClick={() => onMove(1)} className="rounded px-2 py-1 text-sm hover:bg-shell disabled:opacity-30">
          ↓
        </button>
        <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-shell">
          Quitar
        </button>
      </div>
      {/* Closed blocks stay in the form (hidden, not removed), so every field is saved. */}
      <div hidden={!open} className="space-y-4 border-t border-line px-4 py-4">
        <p className="text-xs text-ink-muted">{description}</p>
        {fields.map((f) => (
          <FieldInput key={f.name} field={f} name={`${prefix}.${f.name}`} value={block.data[f.name]} />
        ))}
      </div>
    </li>
  )
}

function FieldInput({ field, name, value }: { field: FieldDef; name: string; value: FieldData[string] | undefined }) {
  if (field.kind === 'list') return <ListInput field={field} name={name} rows={(value as ListRow[] | undefined) ?? []} />
  return <ScalarInput field={field} name={name} value={value as ScalarValue | undefined} />
}

function ScalarInput({ field: f, name, value }: { field: ScalarField; name: string; value: ScalarValue | undefined }) {
  const common = { name, label: f.label, help: f.help, required: f.required }
  switch (f.kind) {
    case 'text':
      return <TextField {...common} defaultValue={(value as string) ?? ''} maxLength={f.max} placeholder={f.placeholder} />
    case 'textarea':
      return <TextArea {...common} defaultValue={(value as string) ?? ''} rows={f.rows ?? 3} />
    case 'markdown':
      return <TextArea {...common} help={f.help ?? MARKDOWN_HELP} defaultValue={(value as string) ?? ''} rows={f.rows ?? 6} />
    case 'link':
      return <TextField {...common} defaultValue={(value as string) ?? ''} placeholder="/diagnostico" />
    case 'image': {
      const key = (value as string) || ''
      // Keyed by the stored key: once an upload is saved the file input starts empty again.
      return <ImageField key={key} {...common} defaultKey={key} previewUrl={key ? mediaUrl(key) : null} />
    }
    case 'focal': {
      const v = (value as Focal | undefined) ?? { x: 50, y: 50 }
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{f.label}</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField name={`${name}.x`} label="Horizontal (%)" type="number" defaultValue={v.x} help={f.help} />
            <TextField name={`${name}.y`} label="Vertical (%)" type="number" defaultValue={v.y} />
          </div>
        </fieldset>
      )
    }
    case 'boolean':
      return <Checkbox {...common} defaultChecked={value === true} />
    case 'select':
      return <Select {...common} options={f.options} defaultValue={(value as string) ?? f.options[0]?.value} />
    case 'codes':
      return <LinesField {...common} defaultValues={(value as string[]) ?? []} rows={3} />
    case 'number':
      return <TextField {...common} type="number" defaultValue={(value as number) ?? f.min} />
  }
}

function ListInput({ field, name, rows: initial }: { field: Extract<FieldDef, { kind: 'list' }>; name: string; rows: ListRow[] }) {
  const [rows, setRows] = useState<ListRow[]>(initial)
  const error = useFieldError(name)
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d
      if (j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">
        {field.label} <span className="font-normal text-ink-muted">(hasta {field.max})</span>
      </legend>
      <input type="hidden" name={name} value={JSON.stringify(rows.map((r) => r._id))} />
      {rows.map((row, i) => (
        <div key={row._id} className="space-y-3 rounded-lg border border-line bg-shell/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {field.itemLabel} {i + 1}
            </p>
            <div className="flex gap-1">
              <button type="button" aria-label={`Subir ${field.itemLabel.toLowerCase()} ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-2 text-sm hover:bg-shell disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label={`Bajar ${field.itemLabel.toLowerCase()} ${i + 1}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded px-2 text-sm hover:bg-shell disabled:opacity-30">
                ↓
              </button>
              <button type="button" onClick={() => setRows((rs) => rs.filter((r) => r._id !== row._id))} className="rounded px-2 text-xs text-ink-muted hover:bg-shell">
                Quitar
              </button>
            </div>
          </div>
          {field.fields.map((f) => (
            <ScalarInput key={f.name} field={f} name={`${name}.${row._id}.${f.name}`} value={row[f.name]} />
          ))}
        </div>
      ))}
      {rows.length < field.max && (
        <button type="button" onClick={() => setRows((rs) => [...rs, { _id: newId() } as ListRow])} className="text-sm font-medium underline underline-offset-2">
          Agregar {field.itemLabel.toLowerCase()}
        </button>
      )}
      {error && <p className="text-xs font-medium text-[oklch(0.5_0.17_25)]">{error}</p>}
    </fieldset>
  )
}
