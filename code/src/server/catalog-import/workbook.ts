// Reads an XLSX workbook into plain rows: one object per data row, keyed by
// the header in row 1, with every value as trimmed text. Typing and
// validation happen in validate.ts, so the report can name row and field.
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const COMMENTS_REL = /<Relationship\b[^>]*Type="[^"]*\/comments"[^>]*\/>/g

/**
 * Removes the links from sheets to their cell notes. exceljs only finds notes
 * stored as xl/commentsN.xml and fails on xl/comments/commentN.xml, which
 * openpyxl and other tools write. The import never reads notes, so dropping
 * the links is safe; cells and values are untouched.
 */
async function withoutCommentLinks(data: ArrayBuffer | Uint8Array): Promise<Uint8Array | ArrayBuffer> {
  const zip = await JSZip.loadAsync(data)
  const rels = zip.file(/^xl\/worksheets\/_rels\/.*\.rels$/)
  let changed = false
  for (const file of rels) {
    const xml = await file.async('string')
    const cleaned = xml.replace(COMMENTS_REL, '')
    if (cleaned !== xml) {
      zip.file(file.name, cleaned)
      changed = true
    }
  }
  return changed ? zip.generateAsync({ type: 'uint8array' }) : data
}

export type SheetRow = { row: number; cells: Record<string, string> }
export type Sheet = { name: string; headers: string[]; rows: SheetRow[] }
export type Workbook = Map<string, Sheet>

/** Text of a cell whatever exceljs returns: rich text, formula result, link, date. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim()
    if ('formula' in value || 'sharedFormula' in value) return cellText((value as { result?: ExcelJS.CellValue }).result ?? null)
    if ('hyperlink' in value) return cellText((value as { text?: ExcelJS.CellValue }).text ?? value.hyperlink)
    if ('error' in value) return ''
  }
  return String(value).trim()
}

/** Columns that are part of the template's layout, never data. */
const IGNORED_HEADERS = new Set(['control'])

export async function readWorkbook(data: ArrayBuffer | Uint8Array): Promise<Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await withoutCommentLinks(data)) as ArrayBuffer)
  const sheets: Workbook = new Map()
  wb.eachSheet((ws) => {
    const headerRow = ws.getRow(1)
    const columns: { col: number; header: string }[] = []
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = cellText(cell.value)
      if (header && !IGNORED_HEADERS.has(header.toLowerCase())) columns.push({ col, header })
    })
    const rows: SheetRow[] = []
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const cells: Record<string, string> = {}
      let empty = true
      for (const { col, header } of columns) {
        const text = cellText(row.getCell(col).value)
        cells[header] = text
        if (text !== '') empty = false
      }
      if (!empty) rows.push({ row: r, cells })
    }
    sheets.set(ws.name, { name: ws.name, headers: columns.map((c) => c.header), rows })
  })
  return sheets
}
