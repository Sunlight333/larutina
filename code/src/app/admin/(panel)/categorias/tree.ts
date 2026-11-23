// Categories as an indented tree: parents first, children under them by order.
export type TreeNode = { id: string; parentId: string | null; name: string; sortOrder: number | null }

export function flattenTree<T extends TreeNode>(rows: T[]): (T & { depth: number })[] {
  const byParent = new Map<string | null, T[]>()
  const ids = new Set(rows.map((r) => r.id))
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null
    byParent.set(key, [...(byParent.get(key) ?? []), r])
  }
  const sort = (list: T[]) => [...list].sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name))
  const out: (T & { depth: number })[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const r of sort(byParent.get(parent) ?? [])) {
      out.push({ ...r, depth })
      if (depth < 10) walk(r.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
