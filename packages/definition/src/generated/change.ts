/* eslint-disable */
// GENERATED from packages/definition/schema — do not edit. Run `pnpm gen:types`.

/**
 * This interface was referenced by `ChangeDocuments`'s JSON-Schema
 * via the `definition` "ChangeArea".
 */
export type ChangeArea =
  'Pages' | 'Logic' | 'Database' | 'Storage' | 'Settings' | 'Permissions' | 'Workflow' | 'Components'

/**
 * Changes (JSON Patch RFC 6902 ops + metadata) and releases (requirements §5).
 */
export interface ChangeDocuments {
  change?: Change
  release?: Release
}
/**
 * This interface was referenced by `ChangeDocuments`'s JSON-Schema
 * via the `definition` "Change".
 */
export interface Change {
  id: string
  /**
   * Upsert key, e.g. api.post_work_orders.access.type. A later edit with the same key replaces the unreleased entry.
   */
  key: string
  area: ChangeArea
  author: string
  authorKind?: 'human' | 'ai'
  /**
   * Plain-language summary shown in Releases.
   */
  text: string
  /**
   * Readable path such as ~ logic.apis.post_work_orders.access
   */
  machinePath?: string
  ops: PatchOp[]
  baseVersion: number
  createdAt: string
  releaseId?: string
}
/**
 * This interface was referenced by `ChangeDocuments`'s JSON-Schema
 * via the `definition` "PatchOp".
 */
export interface PatchOp {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
  path: string
  from?: string
  value?: unknown
}
/**
 * This interface was referenced by `ChangeDocuments`'s JSON-Schema
 * via the `definition` "Release".
 */
export interface Release {
  id: string
  name: string
  note?: string
  fromVersion: number
  toVersion: number
  changes: string[]
  migrations: string[]
  deployments: Deployment[]
  createdAt: string
  createdBy: string
}
/**
 * This interface was referenced by `ChangeDocuments`'s JSON-Schema
 * via the `definition` "Deployment".
 */
export interface Deployment {
  env: 'development' | 'staging' | 'production'
  status: 'pending' | 'awaiting_approval' | 'running' | 'succeeded' | 'failed' | 'rolled_back'
  at?: string
  by?: string
}
