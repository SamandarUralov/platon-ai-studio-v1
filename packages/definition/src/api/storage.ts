/**
 * Studio API contract — storage (requirements §3.5, §6.1, §6.5).
 *
 * Storage *configuration* (connections, buckets, folders, quotas) lives in the app definition and is
 * edited through changes. These endpoints only cover what the definition can't hold: live stats,
 * credential hints, connection tests and file browsing, all per environment.
 *
 *   GET    /projects/{id}/storage/object                                → ObjectStorageListResponse
 *   POST   /projects/{id}/storage/object:test                           StorageTestRequest → StorageTestResponse
 *   POST   /projects/{id}/storage/object/{sid}:test                     → StorageTestResponse
 *   PUT    /projects/{id}/storage/object/{sid}/credentials/{env}        CredentialsRequest → CredentialsResponse
 *   GET    /projects/{id}/storage/local                                 → LocalStorageStatus
 *   GET    {base}/files?prefix=&q=                                      → FileListResponse
 *   POST   {base}/files            (multipart: file[], prefix)          → FileUploadResponse
 *   DELETE {base}/files?key=                                            → 204
 *   GET    {base}/files/content?key=                                    → file bytes
 *   POST   {base}/files/link       SignedLinkRequest                    → SignedLinkResponse (buckets only)
 *
 * where {base} is `/projects/{id}/storage/object/{sid}/buckets/{bucket}` or
 * `/projects/{id}/storage/local/folders/{folderId}`.
 */
import type { EnvName } from '../generated/app-definition'

export const STORAGE_ENVS: readonly EnvName[] = ['development', 'staging', 'production']

/** One stored object or local file. `key` is the full path inside the bucket/folder. */
export interface StorageFile {
  key: string
  size: number
  modifiedAt: string
  contentType?: string
}

export interface FileListResponse {
  env: EnvName
  prefix: string
  /** Immediate sub-prefixes ("folders") of `prefix`, each ending with `/`. Empty while searching. */
  folders: string[]
  items: StorageFile[]
}

export interface FileUploadResponse {
  items: StorageFile[]
}

export interface SignedLinkRequest {
  key: string
  /** Seconds; defaults to one hour (requirements §6.5). */
  expiresIn?: number
}

export interface SignedLinkResponse {
  url: string
  expiresAt: string
}

export interface BucketStats {
  name: string
  objects: number
  bytes: number
}

/** Masked hint of a stored key, e.g. "AKIA…7Q2D". The secret itself is never returned. */
export type CredentialHints = Partial<Record<EnvName, string>>

export interface ObjectStorageStatus {
  id: string
  env: EnvName
  buckets: BucketStats[]
  totalBytes: number
  credentials: CredentialHints
}

export interface ObjectStorageListResponse {
  items: ObjectStorageStatus[]
}

export interface StorageTestRequest {
  provider: 'minio' | 's3'
  endpoint: string
  region?: string
  tls?: boolean
  accessKey: string
  secretKey: string
  bucket?: string
}

export interface StorageTestResponse {
  ok: boolean
  message: string
  latencyMs?: number
}

export interface CredentialsRequest {
  accessKey: string
  secretKey: string
}

export interface CredentialsResponse {
  /** Reference to store in the definition, e.g. secret://field_files/staging. */
  ref: string
  hint: string
}

export interface LocalFolderStatus {
  id: string
  usedBytes: number
  files: number
  /** Free-text purpose kept by the server agent (not part of the definition yet). */
  purpose?: string
}

export interface LocalStorageStatus {
  env: EnvName
  host: string
  os: string
  totalBytes: number
  usedBytes: number
  lastBackupAt: string | null
  folders: LocalFolderStatus[]
}

const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }

/** "5 GB" → bytes. Anything without a number (e.g. "No limit") means unlimited. */
export function parseSize(s: string | undefined | null): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?\s*$/i.exec(s ?? '')
  if (!m) return Number.POSITIVE_INFINITY
  return Math.round(Number(m[1]) * UNITS[(m[2] ?? 'B').toUpperCase()]!)
}
