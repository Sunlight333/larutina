// What a bulk preview sends to the browser: display rows only, plus the
// changes as JSON for the apply step (checked again on the server).
export type BulkRow = { row?: number; ref: string; product: string; what: string; from: string; to: string }
export type BulkState = {
  ok: boolean
  message?: string
  rows?: BulkRow[]
  errors?: { row?: number; ref: string; message: string }[]
  count?: number
  payload?: string
  at?: number
} | null
