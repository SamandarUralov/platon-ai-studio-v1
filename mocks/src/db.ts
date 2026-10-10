/**
 * In-memory mock backend state, persisted to localStorage so edits survive a reload.
 * `resetMockDb()` (also on window.__platonResetMocks) restores the seed.
 */
import type { AppDefinition, Change, Member, ProjectSummary, Release } from '@platon/definition'
import { fieldopsDefinition, MEMBERS, PROJECTS, seedChanges, seedRecords, seedReleases } from './seed'

export interface ProjectState {
  definition: AppDefinition
  changes: Change[]
  releases: Release[]
  members: Member[]
  records: Record<string, Record<string, unknown>[]>
  /** Extra per-feature state, keyed by feature (logic runs, queue messages, files...). */
  ext: Record<string, unknown>
}

interface DbShape {
  v: number
  projects: ProjectSummary[]
  state: Record<string, ProjectState>
}

const KEY = 'platon.mockdb'
const SCHEMA_V = 3

function definitionFor(p: ProjectSummary): AppDefinition {
  const def = fieldopsDefinition()
  if (p.id === 'fieldops') return def
  // Other demo apps reuse the FieldOps structure under their own name.
  return {
    ...def,
    id: p.id,
    name: p.name,
    version: p.version,
    settings: { ...def.settings, slug: p.slug, theme: { ...def.settings.theme!, color: p.accent } },
  }
}

export function freshState(p: ProjectSummary): ProjectState {
  return {
    definition: definitionFor(p),
    changes: p.id === 'fieldops' ? seedChanges() : [],
    releases: p.id === 'fieldops' ? seedReleases() : [],
    members: structuredClone(MEMBERS),
    records: seedRecords(),
    ext: {},
  }
}

function seedDb(): DbShape {
  const projects = structuredClone(PROJECTS)
  return { v: SCHEMA_V, projects, state: Object.fromEntries(projects.map((p) => [p.id, freshState(p)])) }
}

function load(): DbShape {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbShape
      if (parsed.v === SCHEMA_V) return parsed
    }
  } catch {
    // Corrupt or blocked storage: fall back to the seed.
  }
  return seedDb()
}

export const db: DbShape = load()

let timer: ReturnType<typeof setTimeout> | null = null
export function persist(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(db))
    } catch {
      // Quota or privacy mode — mocks still work in memory.
    }
  }, 150)
}

export function resetMockDb(): void {
  const fresh = seedDb()
  db.projects = fresh.projects
  db.state = fresh.state
  try {
    globalThis.localStorage?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function project(id: string): ProjectState | undefined {
  return db.state[id]
}

/** Lazily initialised per-feature state bucket. */
export function ext<T>(projectId: string, key: string, init: () => T): T {
  const s = db.state[projectId]
  if (!s) throw new Error(`Unknown project ${projectId}`)
  if (!(key in s.ext)) s.ext[key] = init()
  return s.ext[key] as T
}
