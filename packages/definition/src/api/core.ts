/** Studio API contract (requirements §6.1) — shared by the Studio client and the MSW mocks. */
import type { AppDefinition, EnvName } from '../generated/app-definition'
import type { Change, PatchOp } from '../generated/change'
import type { Member, Presence, Problem, ProjectSummary, StudioUser } from '../project'

export const API_BASE = '/api/v1'

/** Error body for every non-2xx response. */
export interface ApiErrorBody {
  error: string
  message: string
  details?: { path?: string; problem: string }[]
}

export interface Paged<T> {
  items: T[]
  next?: string | null
  total?: number
}

export interface SessionResponse {
  user: StudioUser
  organization: { id: string; name: string }
  /** Admin panel access. */
  isPlatformAdmin: boolean
}

export interface ProjectsResponse {
  items: ProjectSummary[]
}

export interface CreateProjectRequest {
  name: string
  purpose: string
  requirements: string[]
  signIn: string[]
  modules: string[]
  theme: { color: string; mode: 'light' | 'dark' | 'system'; radius: 'sharp' | 'soft' | 'round' }
  languages: string[]
  team: { userId: string; role: string }[]
  data: { engine: string; storage: 'new' | 'shared'; sample: boolean }
  /** Copy of an existing project instead of a generated one. */
  copyFrom?: string
}

export interface DefinitionResponse {
  version: number
  definition: AppDefinition
}

export interface ApplyChangesRequest {
  baseVersion: number
  changes: Pick<Change, 'key' | 'area' | 'text' | 'ops' | 'machinePath'>[]
  /** Mark these as authored by Studio AI (plan apply). */
  authorKind?: 'human' | 'ai'
}

export interface ApplyChangesResponse {
  version: number
  changes: Change[]
}

/** 409 body: the client must rebase onto `version` and retry. */
export interface ConflictBody extends ApiErrorBody {
  error: 'conflict'
  version: number
  ops: PatchOp[]
}

export interface ValidateResponse {
  problems: Problem[]
  checkedAt: string
}

export interface MembersResponse {
  items: Member[]
}

export interface PresenceResponse {
  items: Presence[]
}

export type { EnvName }
