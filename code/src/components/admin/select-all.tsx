'use client'

// A header checkbox that checks or clears every row checkbox with the given
// name in the same form, for bulk actions on a DataTable.
export function SelectAll({ name, label = 'Seleccionar todos' }: { name: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4 accent-ink"
      onChange={(e) => {
        const form = e.currentTarget.form
        if (!form) return
        for (const el of form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)) el.checked = e.currentTarget.checked
      }}
    />
  )
}
