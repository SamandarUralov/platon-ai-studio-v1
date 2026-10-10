/**
 * Studio API contract — data layer (requirements §3.4, §6.1).
 * Records live per environment and never ship with releases; structure lives in the definition.
 */
import type { DbEngine, EnvName, SecretRef } from '../generated/app-definition'

/** One record as the data browser sees it. `_test` marks rows made by "Generate test data". */
export type DataRow = Record<string, unknown> & { id: string; _test?: boolean }

/** GET /projects/{id}/data/stats?env= — record counts per table (left panel, header pills). */
export interface DataStatsResponse {
  env: EnvName
  counts: Record<string, number>
  testCounts: Record<string, number>
}

/** GET /projects/{id}/data/tables/{tableId}/rows?env=&offset=&limit=&q=&sort=&dir= */
export interface RowsQuery {
  env?: EnvName
  offset?: number
  limit?: number
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface RowsResponse {
  items: DataRow[]
  /** Rows matching `q` (before paging). */
  total: number
  offset: number
}

/** POST …/rows and PATCH …/rows/{rowId}. Only Development is writable from Studio. */
export interface RowWriteRequest {
  values: Record<string, unknown>
}

/** POST /projects/{id}/data/test-data */
export interface TestDataRequest {
  tableId: string
  count: number
}

export interface TestDataResponse {
  added: number
  total: number
}

/** DELETE /projects/{id}/data/test-data?tableId= */
export interface RemoveTestDataResponse {
  removed: number
}

/** POST /projects/{id}/data/sql — console, Development only unless the org allows otherwise. */
export interface SqlRequest {
  sql: string
  connectionId: string
  env: EnvName
}

export interface SqlResponse {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  elapsedMs: number
  /** Shown when the statement returned no grid (or as a note above it). */
  message?: string
  truncated?: boolean
}

/**
 * POST /projects/{id}/data/test-connection — either an existing connection (`connectionId`)
 * or a draft from the New database form. Secrets are sent once and never returned.
 */
export interface TestConnectionRequest {
  connectionId?: string
  env: EnvName
  engine?: DbEngine
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  uri?: string
  ssl?: boolean
}

export interface TestConnectionResponse {
  ok: boolean
  latencyMs: number
  serverVersion?: string
  message: string
}

/** PUT /projects/{id}/data/connections/{connId}/credentials/{env} — write-only; returns the reference. */
export interface PutSecretRequest {
  value: string
}

export interface PutSecretResponse {
  ref: SecretRef
  updatedAt: string
}
