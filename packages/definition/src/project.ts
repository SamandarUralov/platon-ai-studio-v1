/** Studio-side records that are not part of the app definition itself. */
import type { EnvName } from './generated/app-definition'

export type ProjectStatus = 'draft' | 'development' | 'staging' | 'production' | 'archived'

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  description: string
  status: ProjectStatus
  /** Brand accent and card tint used on the Projects home. */
  accent: string
  tint: string
  updatedAt: string
  updatedBy: string
  copiedFrom?: string
  version: number
  /** Name of the release running in Production, e.g. "v1.4". */
  liveRelease?: string
}

export type StudioRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface StudioUser {
  id: string
  name: string
  email: string
  role: StudioRole
}

export interface Member extends StudioUser {
  /** GitLab-style project role used during project creation. */
  projectRole?: 'owner' | 'maintainer' | 'developer' | 'reporter' | 'planner' | 'guest'
  invitedAt?: string
  lastSeenAt?: string
}

export interface Presence {
  userId: string
  name: string
  location: string
  editing?: string
}

export interface Problem {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  /** Pointer into the definition, e.g. /logic/functions/assign_nearest_tech/steps/s3 */
  path: string
  line?: number
  column?: number
}

export const ENVIRONMENTS: { id: EnvName; label: string }[] = [
  { id: 'development', label: 'Development' },
  { id: 'staging', label: 'Staging' },
  { id: 'production', label: 'Production' },
]
