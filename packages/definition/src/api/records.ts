/** Studio API contract — table records (Development data shown on the canvas and in Preview). */
import type { EnvName } from '../generated/app-definition'

export type RecordRow = Record<string, unknown> & { id: string }

/** GET /projects/{id}/data/tables/{tableId}/records?env=&limit=&q= */
export interface RecordsQuery {
  env?: EnvName
  limit?: number
  /** Case-insensitive match against any text value. */
  q?: string
}

export interface RecordsResponse {
  tableId: string
  env: EnvName
  items: RecordRow[]
  total: number
}
