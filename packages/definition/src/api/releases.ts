/**
 * Studio API contract — releases, deployments, tests and the console shell (requirements §3.7, §6.1).
 *
 * A release moves structure only: definition diff, generated DB migrations and storage
 * provisioning. Records, files, queue messages and run history never leave their environment.
 */
import type { EnvName } from '../generated/app-definition'
import type { Change, Deployment, Release } from '../generated/change'

/** One generated SQL migration, e.g. V143__add_priority_to_work_orders.sql. */
export interface Migration {
  file: string
  /** Connection the migration runs on. */
  connection: string
  summary: string
  sql: string
  /** Drops a table or column — existing data in that column/table is lost in the target env. */
  destructive?: boolean
}

export type ProvisioningKind = 'object_storage' | 'bucket' | 'folder'

/** Storage resource created/updated/removed in the target environment. */
export interface ProvisioningStep {
  kind: ProvisioningKind
  action: 'create' | 'update' | 'remove'
  /** Human-readable target, e.g. "field_files / fieldops-signatures". */
  target: string
  summary: string
}

export interface EnvironmentState {
  env: EnvName
  /** Release currently running there, if any. */
  releaseId: string | null
  releaseName: string | null
  status: Deployment['status'] | 'idle'
  at: string | null
  by: string | null
  /** A release waiting for Owner/Admin approval (Production only). */
  pending: { releaseId: string; releaseName: string; requestedBy: string; at: string } | null
  /** Running deployment job, if any. */
  jobId: string | null
}

export interface ReleasesResponse {
  items: Release[]
  environments: EnvironmentState[]
}

export interface ReleasePreviewResponse {
  /** Suggested next name, e.g. "v1.5". */
  suggestedName: string
  changeCount: number
  migrations: Migration[]
  provisioning: ProvisioningStep[]
}

export interface CreateReleaseRequest {
  name: string
  note?: string
}

export interface ReleaseDetailResponse {
  release: Release
  changes: Change[]
  migrations: Migration[]
  provisioning: ProvisioningStep[]
}

export type DeployStepId = 'validate' | 'migrations' | 'provisioning' | 'deploy'

export interface DeployStep {
  id: DeployStepId
  label: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  detail?: string
}

export interface DeploymentJob {
  id: string
  releaseId: string
  releaseName: string
  env: EnvName
  status: 'awaiting_approval' | 'running' | 'succeeded' | 'failed'
  steps: DeployStep[]
  startedAt: string
  finishedAt?: string
  by: string
  error?: string
}

/** `POST /projects/{id}/releases/{rid}:deploy?env=` — Production by an Editor becomes an approval request. */
export interface DeployResponse {
  job: DeploymentJob
}

/** `POST /projects/{id}/releases/{rid}:rollback?env=` — puts this release back on `env`. */
export interface RollbackResponse {
  environments: EnvironmentState[]
}

// ---- Tests -----------------------------------------------------------------------------------

export type TestKind = 'function' | 'api' | 'page'

export interface TestCase {
  id: string
  /** Item under test, e.g. "calcSlaDue" or "POST /work-orders". */
  group: string
  kind: TestKind
  name: string
}

export interface TestResult {
  id: string
  status: 'pass' | 'fail'
  ms: number
  error?: string
}

export interface TestsResponse {
  items: TestCase[]
}

export interface RunTestsRequest {
  /** Omit to run everything. */
  ids?: string[]
}

export interface RunTestsResponse {
  results: TestResult[]
  ranAt: string
}

// ---- Console shell (Development only) --------------------------------------------------------

export interface ShellCallRequest {
  fn: string
  args: Record<string, unknown>
}

export interface ShellCallResponse {
  result: unknown
  ms: number
  logs: string[]
}

export interface ShellQueryRequest {
  sql: string
}

export interface ShellQueryResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  ms: number
}
