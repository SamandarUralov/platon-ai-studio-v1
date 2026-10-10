/**
 * Studio API contract — Admin panel (whole Studio, admins only).
 * Secrets (provider keys, sandbox env secrets, git tokens) are write-only: responses say only whether
 * a value is set (§7.3).
 */
import type { StudioRole } from '../project'

export type AdminArea =
  'Studio' | 'Users' | 'Roles' | 'Projects' | 'AI' | 'Databases' | 'Sandboxes' | 'Modules'

export interface AuditEntry {
  id: string
  at: string
  who: string
  text: string
  area: AdminArea
}

export interface AdminOverview {
  activeUsers: number
  projects: number
  aiSpent: number
  aiBudget: number
  aiWarnAt: number
  dbDiskUsedGb: number
  enginesRunning: number
  inactiveUsers: number
  projectsWithoutRelease: string[]
  sandboxUpdates: number
  recent: AuditEntry[]
}

export interface AdminStudioSettings {
  name: string
  url: string
  language: string
  timezone: string
  smtp: string
  from: string
  support: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: StudioRole
  projects: number
  lastActiveAt: string | null
  active: boolean
  invited?: boolean
}

export interface InviteAdminUserRequest {
  email: string
  role: StudioRole
}

export interface AdminPermission {
  id: string
  label: string
}

export interface AdminRole {
  id: string
  name: string
  builtin: boolean
  permissions: string[]
}

export interface AdminRolesResponse {
  permissions: AdminPermission[]
  roles: AdminRole[]
}

export type AdminProjectStatus = 'live' | 'staging' | 'draft' | 'archived'

export interface AdminProject {
  id: string
  name: string
  owner: string
  envs: number
  sizeBytes: number
  lastRelease: string | null
  releasedAt: string | null
  status: AdminProjectStatus
  accent: string
}

// ── AI ───────────────────────────────────────────────────────────────────────────────

export type AiProviderId = 'claude' | 'gpt' | 'local'

export interface AiProvider {
  id: AiProviderId
  name: string
  kind: string
  enabled: boolean
  /** Whether an API key is stored (local models need none). */
  keySet: boolean
  needsKey: boolean
  models: string[]
  enabledModels: string[]
  defaultModel: string
}

export type AiFeature = 'chat' | 'plans' | 'code' | 'translate' | 'summaries'
export const AI_FEATURES: AiFeature[] = ['chat', 'plans', 'code', 'translate', 'summaries']

export interface McpServer {
  id: string
  name: string
  url: string
  enabled: boolean
}

export interface AiUsageDay {
  date: string
  /** Millions of tokens. */
  input: number
  output: number
}

export interface AiModelUsage {
  model: string
  provider: AiProviderId
  cost: number
  input: number
  output: number
}

export interface AiSettings {
  providers: AiProvider[]
  defaultProvider: AiProviderId
  featureModels: Record<AiFeature, string>
  budget: number
  warnAt: number
  spent: number
  usage: AiUsageDay[]
  byModel: AiModelUsage[]
  byProject: { project: string; input: number; output: number }[]
  policy: { noProduction: boolean; noSecrets: boolean; localOnly: boolean }
  mcp: McpServer[]
}

export type UpdateAiSettingsRequest = Partial<
  Pick<AiSettings, 'defaultProvider' | 'featureModels' | 'budget' | 'warnAt' | 'policy'>
>

export interface UpdateAiProviderRequest {
  enabled?: boolean
  enabledModels?: string[]
  defaultModel?: string
  /** Replace-only. Empty string removes the key. */
  key?: string
}

// ── Databases ────────────────────────────────────────────────────────────────────────

export type ManagedEngineId = 'pg' | 'mysql' | 'redis'

export interface ManagedDbEngine {
  id: ManagedEngineId
  name: string
  version: string
  port: number
  running: boolean
  diskUsedGb: number
  diskTotalGb: number
  connections: number
  maxConnections: number
}

export type DbBackupSchedule = 'off' | 'weekly' | 'daily' | '6h' | 'hourly'

export interface ManagedDatabase {
  name: string
  engine: ManagedEngineId
  project: string
  env: 'development' | 'staging' | 'production' | 'shared'
  sizeBytes: number
  backup: DbBackupSchedule
}

export interface DatabasesResponse {
  host: string
  engines: ManagedDbEngine[]
  databases: ManagedDatabase[]
}

export interface CreateDatabaseRequest {
  name: string
  engine: ManagedEngineId
  project: string
  env: ManagedDatabase['env']
}

// ── Sandboxes ────────────────────────────────────────────────────────────────────────

export type SandboxId = 'frontend' | 'backend'
export type SandboxSource = 'git' | 'template' | 'image' | 'archive'

export interface SandboxEnvVar {
  id: string
  key: string
  secret: boolean
  /** Plain values only. */
  value?: string
  /** For secrets: whether a value is stored. */
  set?: boolean
}

export interface SandboxConfig {
  source: SandboxSource
  git: {
    url: string
    refType: 'tag' | 'branch' | 'commit'
    ref: string
    path: string
    auth: 'public' | 'token' | 'ssh'
    tokenSet: boolean
    publicKey: string
    autoSync: boolean
  }
  template: { channel: 'stable' | 'lts' | 'beta'; version: string }
  image: { ref: string; pullSecret: string; pinDigest: boolean }
  archive: { file: string; sizeBytes: number }
  run: {
    pm: 'npm' | 'pnpm' | 'yarn'
    install: string
    dev: string
    build: string
    port: number
    health: string
  }
  resources: { cpu: string; memory: string; disk: string; idle: string; maxRunning: number }
  network: { mode: 'open' | 'allowlist' | 'blocked'; allow: string[]; registry: string; proxy: string }
  env: SandboxEnvVar[]
  ai: { folders: string[]; writable: string[]; review: boolean }
}

export interface Sandbox extends SandboxConfig {
  id: SandboxId
  name: string
  kind: string
  running: boolean
  version: string
  commit: string
  appliedAt: string
  appliedBy: string
  stack: { name: string; version: string }[]
  latest: {
    version: string
    commit: string
    note: string
    diff: { name: string; from: string; to: string }[]
  } | null
  templateVersions: string[]
  manifest: string
  projects: { projectId: string; name: string; version: string; running: boolean }[]
  history: { version: string; at: string; by: string; note: string }[]
}

/** Save body: secrets are sent only when replaced (`value` present on a secret var or `gitToken`). */
export type UpdateSandboxRequest = SandboxConfig & { gitToken?: string }

export type SandboxRollout = 'new' | 'all' | 'choose'

export interface SandboxTestResult {
  ok: boolean
  lines: { ok: boolean; text: string }[]
}

// ── Modules ──────────────────────────────────────────────────────────────────────────

export type AdminModuleGroupId = 'auth' | 'brokers' | 'features'

export interface AdminModule {
  id: string
  label: string
  description: string
  icon: string
  enabled: boolean
  impact?: string
}

export interface AdminModuleGroup {
  id: AdminModuleGroupId
  label: string
  description: string
  /** At least one item must stay on (sign-in methods, brokers). */
  keepOne: boolean
  items: AdminModule[]
}
