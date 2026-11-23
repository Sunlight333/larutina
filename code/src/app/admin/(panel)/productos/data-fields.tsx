import { LISTS } from '@/server/catalog-import/lists'
import { DATA_FIELDS, isRequired, SECTIONS, type DataField, type DataValues } from '@/server/services/admin/catalog/product-fields'
import { LinesField, MultiCheck, Select, TextArea, TextField } from '@/components/admin/fields'

type Option = { value: string; label: string }

/** Every "Datos" field, grouped like the product page, with the values given (columns, or columns + draft). */
export function DataFields({
  values,
  brands,
  categories,
  baseProductCode,
  dermatologistLabelEnabled,
}: {
  values: DataValues
  brands: Option[]
  categories: Option[]
  baseProductCode: string | null
  dermatologistLabelEnabled: boolean
}) {
  const sections = Object.entries(SECTIONS) as [DataField['section'], string][]
  return (
    <div className="space-y-8">
      {sections.map(([section, title]) => (
        <fieldset key={section} className="space-y-4">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {DATA_FIELDS.filter((f) => f.section === section).map((f) => (
              <div key={f.name} className={f.kind === 'textarea' || f.kind === 'lines' || f.kind === 'labels' || f.kind === 'skus' ? 'sm:col-span-2' : ''}>
                <Field field={f} value={values[f.name] ?? null} brands={brands} categories={categories} baseProductCode={baseProductCode} dermatologistLabelEnabled={dermatologistLabelEnabled} />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function Field({
  field: f,
  value,
  brands,
  categories,
  baseProductCode,
  dermatologistLabelEnabled,
}: {
  field: DataField
  value: DataValues[string]
  brands: Option[]
  categories: Option[]
  baseProductCode: string | null
  dermatologistLabelEnabled: boolean
}) {
  const common = { name: f.name, label: f.label, help: f.help, required: isRequired(f) }
  const text = value === null || value === undefined ? '' : String(value)
  switch (f.kind) {
    case 'text':
      return <TextField {...common} defaultValue={text} maxLength={f.name === 'headline' ? 120 : undefined} />
    case 'int':
    case 'number':
      return <TextField {...common} defaultValue={text} />
    case 'date':
      return <TextField {...common} type="date" defaultValue={text} />
    case 'textarea':
      return <TextArea {...common} defaultValue={text} rows={f.name === 'description' ? 8 : 3} />
    case 'lines':
    case 'skus':
      return <LinesField {...common} defaultValues={(value as string[] | null) ?? []} rows={f.name === 'benefits' ? 4 : 3} />
    case 'list':
    case 'listOpt':
      return (
        <Select
          {...common}
          defaultValue={text}
          options={LISTS[f.list!].labels.map(([label, v]) => ({ value: v, label }))}
          allowEmpty={f.kind === 'listOpt' || !text ? 'Elegí…' : undefined}
        />
      )
    case 'labels': {
      const options = LISTS.etiqueta.labels
        .filter(([, v]) => dermatologistLabelEnabled || v !== 'DERMATOLOGIST_RECOMMENDED')
        .map(([label, v]) => ({ value: v, label }))
      return (
        <MultiCheck
          {...common}
          defaultValues={(value as string[] | null) ?? []}
          options={options}
          help={dermatologistLabelEnabled ? '"Nuevo" también puede ser automático (Configuración).' : '"Recomendado por dermatóloga" se habilita en Configuración › Catálogo.'}
        />
      )
    }
    case 'brand':
      return <Select {...common} defaultValue={text} options={brands} allowEmpty={text ? undefined : 'Elegí…'} />
    case 'category':
      return <Select {...common} defaultValue={text} options={categories} allowEmpty={text ? undefined : 'Elegí…'} />
    case 'productRef':
      return <TextField {...common} defaultValue={baseProductCode ?? ''} placeholder="codigo-del-producto" />
  }
}
