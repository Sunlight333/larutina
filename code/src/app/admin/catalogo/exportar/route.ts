import ExcelJS from 'exceljs'
import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { currentAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { exportFileName, exportRows, rowCounts, toXlsx, type ExportRows } from '@/server/catalog-export'
import { SHEETS, type SheetName } from '@/server/catalog-import/spec'
import { bulkTemplateRows } from '@/server/services/admin/catalog/bulk'

// Downloads (CAT-02, CAT-04): the whole catalog in template v1.1, the empty
// template, or the price-and-stock sheet for bulk updates. A route handler
// sits outside the panel layout, so it checks the session itself: signed in,
// 2FA passed and allowed to import; cost only for a role that sees it (CAT-20).
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function GET(req: Request) {
  const admin = await currentAdmin()
  if (!admin || !admin.mfaPassed || !can(admin.role, 'catalog.import')) return new Response('Sin permiso.', { status: 403 })
  const url = new URL(req.url)
  const db = getDb()
  const includeCost = can(admin.role, 'catalog.cost')
  const now = new Date()
  const day = now.toISOString().slice(0, 10)

  let data: Buffer
  let fileName: string
  let after: Record<string, unknown>
  if (url.searchParams.get('formato') === 'lote') {
    const rows = await bulkTemplateRows(db)
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Precios y stock', { views: [{ state: 'frozen', ySplit: 1 }] })
    const headers = ['sku', 'codigo_producto', 'producto', 'precio_ars', 'precio_promocional_ars', 'stock', 'estado'] as const
    ws.addRow([...headers])
    ws.getRow(1).font = { bold: true }
    for (const r of rows) ws.addRow(headers.map((h) => r[h]))
    ws.columns.forEach((c, i) => (c.width = i === 2 ? 40 : 18))
    data = Buffer.from(await wb.xlsx.writeBuffer())
    fileName = `LaRutina-Precios-y-stock-${day}.xlsx`
    after = { format: 'lote', variants: rows.length }
  } else if (url.searchParams.has('vacia')) {
    const empty = Object.fromEntries(Object.keys(SHEETS).map((s) => [s, []])) as unknown as ExportRows
    data = await toXlsx(empty, { includeCost, generatedAt: now })
    fileName = 'LaRutina-Catalogo-v1.1-plantilla.xlsx'
    after = { format: 'plantilla' }
  } else {
    const rows = await exportRows(db, { includeCost })
    data = await toXlsx(rows, { includeCost, generatedAt: now })
    fileName = exportFileName(now)
    after = { format: 'catalogo', includeCost, rows: rowCounts(rows) as Partial<Record<SheetName, number>> }
  }

  await audit(db, admin, { action: 'export', entityType: 'Catalog', label: fileName, after })
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
