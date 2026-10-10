/** Pure helpers for the Storage layer (no Vue, no HTTP) — unit tested. */
import {
  parseSize,
  snake,
  uniqueName,
  type AppDefinition,
  type Bucket,
  type LocalFolder,
  type ObjectStorage,
  type Step,
} from '@platon/definition'
import type { Tone } from '@platon/ui'

export type Purpose = NonNullable<ObjectStorage['purpose']>
export type BucketAccess = Bucket['access']
export type FolderAccess = LocalFolder['access']

/** Visual identity of each object-storage purpose. Labels live in i18n under storage.purpose.<id>. */
export const PURPOSES: Record<Purpose, { icon: string; tone: Tone }> = {
  files: { icon: 'paperclip', tone: 'primary' },
  media: { icon: 'image', tone: 'teal' },
  backups: { icon: 'archive', tone: 'warn' },
  exports: { icon: 'file-down', tone: 'purple' },
}

export const ACCESS_TONE: Record<BucketAccess, Tone> = {
  private: 'neutral',
  signed: 'primary',
  public: 'warn',
}
export const BUCKET_ACCESS: BucketAccess[] = ['private', 'signed', 'public']
export const FOLDER_ACCESS: FolderAccess[] = ['none', 'read', 'rw']

/** Cleanup rules offered in the UI; '' keeps files forever. */
export const CLEANUP_OPTIONS = ['', '1d', '7d', '14d', '30d', '90d'] as const
export const QUOTA_OPTIONS = ['1 GB', '2 GB', '5 GB', '10 GB', '20 GB', '50 GB', '100 GB'] as const

/** Above this share of a limit we warn (folders vs quota, server disk). */
export const WARN_PCT = 80

export function usagePct(used: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

export function isNearFull(used: number, total: number): boolean {
  return Number.isFinite(total) && total > 0 && (used / total) * 100 >= WARN_PCT
}

export function folderQuotaBytes(f: Pick<LocalFolder, 'quota'>): number {
  return parseSize(f.quota)
}

/** "7d" → 7; '' / unknown → null (keep forever). */
export function cleanupDays(rule: string | undefined): number | null {
  const m = /^(\d+)\s*d$/.exec(rule?.trim() ?? '')
  return m ? Number(m[1]) : null
}

/** S3 bucket naming rules, simplified: 3–63 chars, lowercase letters, digits, dashes and dots. */
export function bucketNameError(
  name: string,
  taken: readonly string[] = [],
): 'required' | 'length' | 'chars' | 'edges' | 'taken' | null {
  if (!name) return 'required'
  if (name.length < 3 || name.length > 63) return 'length'
  if (!/^[a-z0-9.-]+$/.test(name)) return 'chars'
  if (!/^[a-z0-9].*[a-z0-9]$/.test(name) || name.includes('..')) return 'edges'
  if (taken.includes(name)) return 'taken'
  return null
}

/** Live-typing normaliser for bucket names: lowercase, anything else becomes a dash. */
export function normalizeBucketName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
}

/** Folder path under the local root: segments of [a-z0-9_-], no leading/trailing slash, no "..". */
export function folderPathError(
  path: string,
  taken: readonly string[] = [],
): 'required' | 'chars' | 'taken' | null {
  if (!path) return 'required'
  if (!/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/.test(path)) return 'chars'
  if (taken.includes(path)) return 'taken'
  return null
}

export function normalizeFolderPath(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_\-/]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
}

/** Stable snake_case id for a new connection or folder. */
export function newStorageId(name: string, taken: Iterable<string>, fallback = 'storage'): string {
  return uniqueName(snake(name) || fallback, taken)
}

export function hostOf(endpoint: string): string {
  return endpoint.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '')
}

export function isValidEndpoint(endpoint: string): boolean {
  return /^https?:\/\/[^\s/]+(\/\S*)?$/i.test(endpoint.trim())
}

export function baseName(key: string): string {
  const k = key.endsWith('/') ? key.slice(0, -1) : key
  return k.slice(k.lastIndexOf('/') + 1)
}

/** "WO-1042/photos/" → [{label:'WO-1042', prefix:'WO-1042/'}, {label:'photos', prefix:'WO-1042/photos/'}] */
export function breadcrumbs(prefix: string): { label: string; prefix: string }[] {
  const parts = prefix.split('/').filter(Boolean)
  return parts.map((label, i) => ({ label, prefix: parts.slice(0, i + 1).join('/') + '/' }))
}

export interface UsedByItem {
  kind: 'field' | 'function'
  label: string
  icon: string
  /** Route target ids: table (+ connection) for fields, function id for functions. */
  tableId?: string
  connectionId?: string
  functionId?: string
}

function stepsMention(steps: Step[] | undefined, re: RegExp): boolean {
  return (steps ?? []).some(
    (s) =>
      Object.values(s.config ?? {}).some((v) => typeof v === 'string' && re.test(v)) ||
      (s.branches ?? []).some((b) => stepsMention(b.steps, re)),
  )
}

/** File fields bound to this storage and functions whose steps address `s3://<id>/…`. */
export function usedBy(def: AppDefinition, storageId: string): UsedByItem[] {
  const out: UsedByItem[] = []
  for (const t of def.data?.tables ?? []) {
    for (const f of t.fields) {
      if (f.type === 'file' && f.storage === storageId)
        out.push({
          kind: 'field',
          label: `${t.name} → ${f.name}`,
          icon: t.icon || 'table',
          tableId: t.id,
          connectionId: t.connection,
        })
    }
  }
  // `s3://field_files` but not `s3://field_files_old`.
  const re = new RegExp(`s3://${storageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
  for (const fn of def.logic?.functions ?? []) {
    if (stepsMention(fn.steps, re))
      out.push({ kind: 'function', label: fn.name, icon: 'braces', functionId: fn.id })
  }
  return out
}

/** Folders that back up into this object storage. */
export function backedUpFolders(def: AppDefinition, storageId: string): LocalFolder[] {
  return def.storage.local.folders.filter((f) => f.backup?.enabled && f.backup.target === storageId)
}

/** Environments that still miss a credentials reference. */
export function missingCredentials(
  st: Pick<ObjectStorage, 'credentials'>,
): ('development' | 'staging' | 'production')[] {
  return (['development', 'staging', 'production'] as const).filter((e) => !st.credentials?.[e])
}

/** Lucide icon name for a file row. */
export function fileIcon(key: string, contentType?: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase()
  if (contentType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return 'file-image'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'file-spreadsheet'
  if (ext === 'json') return 'file-braces'
  if (['zip', 'gz', 'tar', 'tgz', '7z'].includes(ext)) return 'file-archive'
  if (['pdf', 'doc', 'docx', 'txt', 'log', 'md'].includes(ext)) return 'file-text'
  if (['html', 'js', 'ts', 'sql', 'xml'].includes(ext)) return 'file-code'
  return 'file'
}
