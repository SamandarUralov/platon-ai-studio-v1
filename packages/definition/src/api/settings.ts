/**
 * Studio API contract — project settings that live outside the app definition (requirements §3.8).
 * Secrets are write-only: responses only say whether a secret is set, never its value (§7.3).
 */

// ── Sign-in & security ───────────────────────────────────────────────────────────────

export type AuthProviderId = 'eimzo' | 'ldap' | 'oneid' | 'google' | 'rsid' | 'keycloak'

export const AUTH_PROVIDER_IDS: AuthProviderId[] = ['eimzo', 'ldap', 'oneid', 'google', 'rsid', 'keycloak']

export type SignupPolicy = 'invite' | 'domains' | 'anyone'
export type MfaPolicy = 'off' | 'optional' | 'staff' | 'everyone'
export type SessionLength = '1h' | '8h' | '7d' | '30d'
export type LockoutPolicy = 'never' | '5_15m' | '10_1h'

export interface AuthProviderConfig {
  /** Non-secret connection fields (server URL, client id, base DN...). */
  fields: Record<string, string>
  /** Secret field name → whether a value is stored. Values never leave the server. */
  secrets: Record<string, boolean>
  /** App role id given to users who sign in for the first time through this provider. */
  defaultRole: string
}

export interface AuthSettings {
  /** Built-in methods. Enabled identity providers are kept in definition.settings.signIn. */
  methods: { magicLink: boolean }
  providers: Record<AuthProviderId, AuthProviderConfig>
  signup: SignupPolicy
  mfa: MfaPolicy
  session: SessionLength
  lockout: LockoutPolicy
  allowedDomains: string[]
}

export type UpdateAuthSettingsRequest = Partial<Omit<AuthSettings, 'providers'>>

export interface UpdateAuthProviderRequest {
  fields?: Record<string, string>
  /** New secret values (replace-only). An empty string clears the secret. */
  secrets?: Record<string, string>
  defaultRole?: string
}

// ── Git ──────────────────────────────────────────────────────────────────────────────

export type GitProvider = 'github' | 'gitlab' | 'bitbucket'

export interface GitConfig {
  connected: boolean
  provider: GitProvider
  repo: string
  branch: string
  path: string
  /** Each release becomes a tagged commit. */
  autoCommit: boolean
  /** Studio changes go through a pull request instead of a direct push. */
  openPr: boolean
  lastSyncAt?: string | null
}

export interface GitCommit {
  hash: string
  message: string
  by: string
  at: string
}

export interface GitResponse {
  config: GitConfig
  commits: GitCommit[]
}

export type UpdateGitRequest = Partial<Omit<GitConfig, 'connected' | 'lastSyncAt'>>

// ── CI/CD ────────────────────────────────────────────────────────────────────────────

export type CiStageId = 'validate' | 'tests' | 'staging' | 'approval' | 'production'
export const CI_STAGE_IDS: CiStageId[] = ['validate', 'tests', 'staging', 'approval', 'production']

export type CiTrigger = 'release' | 'push' | 'manual'
export type CiRunStatus = 'passed' | 'failed' | 'running' | 'waiting'

export interface CiConfig {
  trigger: CiTrigger
  stages: Record<CiStageId, boolean>
}

export interface CiRun {
  n: number
  title: string
  status: CiRunStatus
  /** Human-readable duration or failure summary. */
  detail: string
  at: string
}

export interface CiVariable {
  key: string
  secret: boolean
  /** Only present for plain variables. */
  value?: string
  /** For secrets: whether a value is stored. */
  set?: boolean
}

export interface CiResponse {
  config: CiConfig
  runs: CiRun[]
  variables: CiVariable[]
}

export interface PutCiVariableRequest {
  secret: boolean
  /** Omit to keep the stored secret when only renaming/toggling. */
  value?: string
}

// ── Agent.md ─────────────────────────────────────────────────────────────────────────

export interface AgentDoc {
  content: string
  updatedAt: string
  updatedBy: string
}

// ── Translations ─────────────────────────────────────────────────────────────────────

export interface AiTranslateRequest {
  language: string
  /** Key → source text in the default language. */
  items: Record<string, string>
}

export interface AiTranslateResponse {
  language: string
  translations: Record<string, string>
}
