/**
 * Mock handlers — Admin panel. State is Studio-wide (not per project), kept in a module-level object and
 * persisted to its own localStorage key. Every mutation writes an audit entry.
 */
import { http, HttpResponse } from 'msw'
import type {
  AdminArea,
  AdminModuleGroup,
  AdminOverview,
  AdminProject,
  AdminProjectStatus,
  AdminRolesResponse,
  AdminStudioSettings,
  AdminUser,
  AiSettings,
  CreateDatabaseRequest,
  DatabasesResponse,
  InviteAdminUserRequest,
  ManagedDatabase,
  McpServer,
  Sandbox,
  SandboxRollout,
  SandboxTestResult,
  StudioRole,
  UpdateAiProviderRequest,
  UpdateAiSettingsRequest,
  UpdateSandboxRequest,
} from '@platon/definition'
import { db } from '../db'
import { ME } from '../seed'
import { ADMIN_SCHEMA_V, seedAdmin, type AdminState } from '../seed/admin'
import { api, body, fail, json, latency } from '../http'

const KEY = 'platon.mockadmin'

function load(): AdminState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AdminState
      if (parsed.v === ADMIN_SCHEMA_V) return parsed
    }
  } catch {
    // Corrupt or blocked storage: fall back to the seed.
  }
  return seedAdmin()
}

let A: AdminState = load()

let timer: ReturnType<typeof setTimeout> | null = null
function save(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(A))
    } catch {
      // Quota or privacy mode — mocks still work in memory.
    }
  }, 150)
}

/** Restore the admin seed (dev helper, mirrors window.__platonResetMocks for the project db). */
export function resetAdminMocks(): void {
  A = seedAdmin()
  try {
    globalThis.localStorage?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

function audit(area: AdminArea, text: string): void {
  A.audit.unshift({
    id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    at: new Date().toISOString(),
    who: ME.name,
    text,
    area,
  })
  A.audit = A.audit.slice(0, 300)
  save()
}

function projectStatus(id: string, s: string): AdminProjectStatus {
  if (A.projectMeta[id]?.archived) return 'archived'
  return s === 'production' ? 'live' : s === 'staging' ? 'staging' : 'draft'
}

function adminProjects(): AdminProject[] {
  return db.projects.map((p) => {
    const m = A.projectMeta[p.id] ?? {
      owner: p.updatedBy,
      envs: 1,
      sizeBytes: 12 * 1024 ** 2,
      archived: false,
    }
    const rel = db.state[p.id]?.releases[0]
    return {
      id: p.id,
      name: p.name,
      owner: m.owner,
      envs: m.envs,
      sizeBytes: m.sizeBytes,
      lastRelease: rel?.name ?? p.liveRelease ?? null,
      releasedAt: rel?.createdAt ?? null,
      status: projectStatus(p.id, p.status),
      accent: p.accent,
    }
  })
}

/** Attach the per-project version table (projects come from the shared db). */
function sandboxView(s: Sandbox): Sandbox {
  const prev = s.history[1]?.version ?? s.version
  const pv = A.sandboxProjectVersions
  return {
    ...s,
    projects: db.projects.map((p, i) => ({
      projectId: p.id,
      name: p.name,
      version: pv[s.id]?.[p.id] ?? (i % 3 === 2 ? prev : s.version),
      running: i % 2 === 0,
    })),
  }
}

function setProjectVersion(sid: string, pid: string, version: string) {
  const row = (A.sandboxProjectVersions[sid] ??= {})
  row[pid] = version
}

const ROLE_LABEL: Record<StudioRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export const adminHandlers = [
  // ── Overview ──────────────────────────────────────────────────────────────────────
  http.get(api('/admin/overview'), async () => {
    await latency()
    const monthAgo = Date.now() - 30 * 24 * 3600_000
    const projects = adminProjects()
    return json<AdminOverview>({
      activeUsers: A.users.filter((u) => u.active).length,
      projects: projects.filter((p) => p.status !== 'archived').length,
      aiSpent: A.ai.spent,
      aiBudget: A.ai.budget,
      aiWarnAt: A.ai.warnAt,
      dbDiskUsedGb: Math.round(A.databases.engines.reduce((n, e) => n + e.diskUsedGb, 0)),
      enginesRunning: A.databases.engines.filter((e) => e.running).length,
      inactiveUsers: A.users.filter(
        (u) => u.active && u.lastActiveAt && Date.parse(u.lastActiveAt) < monthAgo,
      ).length,
      projectsWithoutRelease: projects
        .filter((p) => !p.lastRelease && p.status !== 'archived')
        .map((p) => p.name),
      sandboxUpdates: A.sandboxes.filter((s) => s.latest).length,
      recent: A.audit.slice(0, 5),
    })
  }),

  // ── Studio settings ───────────────────────────────────────────────────────────────
  http.get(api('/admin/studio'), async () => {
    await latency()
    return json<AdminStudioSettings>(A.studio)
  }),

  http.patch(api('/admin/studio'), async ({ request }) => {
    await latency()
    const req = await body<Partial<AdminStudioSettings>>(request)
    if (req.name !== undefined && !req.name.trim())
      return fail(400, 'validation', 'The Studio needs a name', [{ path: 'name', problem: 'required' }])
    for (const k of ['from', 'support'] as const)
      if (req[k] !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req[k]!))
        return fail(400, 'validation', 'Enter a valid email address', [{ path: k, problem: 'invalid' }])
    const changed = Object.keys(req).filter(
      (k) => A.studio[k as keyof AdminStudioSettings] !== req[k as keyof AdminStudioSettings],
    )
    A.studio = { ...A.studio, ...req }
    if (changed.length) audit('Studio', `Changed Studio settings: ${changed.join(', ')}`)
    return json<AdminStudioSettings>(A.studio)
  }),

  // ── Users ─────────────────────────────────────────────────────────────────────────
  http.get(api('/admin/users'), async () => {
    await latency()
    return HttpResponse.json({ items: A.users })
  }),

  http.post(api('/admin/users'), async ({ request }) => {
    await latency(300)
    const req = await body<InviteAdminUserRequest>(request)
    const email = (req.email ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return fail(400, 'validation', 'Enter a valid email address', [{ path: 'email', problem: 'invalid' }])
    if (A.users.some((u) => u.email === email))
      return fail(409, 'exists', 'This person already has a Studio account')
    if (req.role === 'owner') return fail(400, 'validation', 'Invite as Admin, then transfer ownership')
    const name = email
      .split('@')[0]!
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    const u: AdminUser = {
      id: `u_${Date.now().toString(36)}`,
      name,
      email,
      role: req.role ?? 'editor',
      projects: 0,
      lastActiveAt: null,
      active: true,
      invited: true,
    }
    A.users.push(u)
    audit('Users', `Invited ${email} as ${ROLE_LABEL[u.role]}`)
    return json<AdminUser>(u, { status: 201 })
  }),

  http.patch(api('/admin/users/:uid'), async ({ params, request }) => {
    await latency()
    const req = await body<{ role?: StudioRole; active?: boolean }>(request)
    const u = A.users.find((x) => x.id === params.uid)
    if (!u) return fail(404, 'not_found', 'User not found')
    const owners = A.users.filter((x) => x.role === 'owner' && x.active)
    if (
      u.role === 'owner' &&
      owners.length === 1 &&
      ((req.role && req.role !== 'owner') || req.active === false)
    )
      return fail(400, 'last_owner', 'The Studio needs at least one active Owner')
    if (u.id === ME.id && req.active === false)
      return fail(400, 'self', 'You can’t deactivate your own account')
    if (req.role && req.role !== u.role) {
      audit('Users', `Changed ${u.name} role to ${ROLE_LABEL[req.role]}`)
      u.role = req.role
    }
    if (req.active !== undefined && req.active !== u.active) {
      u.active = req.active
      audit('Users', `${req.active ? 'Reactivated' : 'Deactivated'} ${u.name}`)
    }
    save()
    return json<AdminUser>(u)
  }),

  // ── Roles & permissions ───────────────────────────────────────────────────────────
  http.get(api('/admin/roles'), async () => {
    await latency()
    return json<AdminRolesResponse>({ permissions: A.permissions, roles: A.roles })
  }),

  http.post(api('/admin/roles'), async ({ request }) => {
    await latency()
    const req = await body<{ name: string }>(request)
    const name = (req.name ?? '').trim()
    if (!name) return fail(400, 'validation', 'Name the role')
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    if (A.roles.some((r) => r.id === id || r.name.toLowerCase() === name.toLowerCase()))
      return fail(409, 'exists', `${name} already exists`)
    A.roles.push({ id, name, builtin: false, permissions: ['ai.use'] })
    audit('Roles', `Created role ${name}`)
    return json<AdminRolesResponse>({ permissions: A.permissions, roles: A.roles }, { status: 201 })
  }),

  http.patch(api('/admin/roles/:rid'), async ({ params, request }) => {
    await latency(90)
    const req = await body<{ permission: string; allowed: boolean }>(request)
    const r = A.roles.find((x) => x.id === params.rid)
    if (!r) return fail(404, 'not_found', 'Role not found')
    if (r.id === 'owner') return fail(400, 'locked', 'Owners always have every permission')
    const label = A.permissions.find((p) => p.id === req.permission)?.label ?? req.permission
    r.permissions = req.allowed
      ? [...new Set([...r.permissions, req.permission])]
      : r.permissions.filter((p) => p !== req.permission)
    audit('Roles', `${req.allowed ? 'Allowed' : 'Removed'} “${label}” for ${r.name}`)
    return json<AdminRolesResponse>({ permissions: A.permissions, roles: A.roles })
  }),

  http.delete(api('/admin/roles/:rid'), async ({ params }) => {
    await latency()
    const r = A.roles.find((x) => x.id === params.rid)
    if (!r) return fail(404, 'not_found', 'Role not found')
    if (r.builtin) return fail(400, 'locked', 'Built-in roles can’t be deleted')
    A.roles = A.roles.filter((x) => x.id !== r.id)
    audit('Roles', `Deleted role ${r.name}`)
    return json<AdminRolesResponse>({ permissions: A.permissions, roles: A.roles })
  }),

  // ── Projects ──────────────────────────────────────────────────────────────────────
  http.get(api('/admin/projects'), async () => {
    await latency()
    return HttpResponse.json({ items: adminProjects() })
  }),

  http.patch(api('/admin/projects/:pid'), async ({ params, request }) => {
    await latency()
    const req = await body<{ archived: boolean }>(request)
    const p = db.projects.find((x) => x.id === params.pid)
    if (!p) return fail(404, 'not_found', 'Project not found')
    const m = (A.projectMeta[p.id] ??= {
      owner: p.updatedBy,
      envs: 1,
      sizeBytes: 12 * 1024 ** 2,
      archived: false,
    })
    m.archived = !!req.archived
    audit('Projects', `${m.archived ? 'Archived' : 'Restored'} ${p.name}`)
    return json<AdminProject | undefined>(adminProjects().find((x) => x.id === p.id))
  }),

  http.post(api('/admin/projects/:pid/open'), async ({ params }) => {
    await latency(60)
    const p = db.projects.find((x) => x.id === params.pid)
    if (!p) return fail(404, 'not_found', 'Project not found')
    audit('Projects', `Opened ${p.name} as admin`)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── AI ────────────────────────────────────────────────────────────────────────────
  http.get(api('/admin/ai'), async () => {
    await latency()
    return json<AiSettings>(A.ai)
  }),

  http.patch(api('/admin/ai'), async ({ request }) => {
    await latency(90)
    const req = await body<UpdateAiSettingsRequest>(request)
    if (req.budget !== undefined && (!Number.isFinite(req.budget) || req.budget < 0))
      return fail(400, 'validation', 'Budget must be a positive number')
    if (req.defaultProvider) {
      const p = A.ai.providers.find((x) => x.id === req.defaultProvider)
      if (!p?.enabled) return fail(400, 'validation', 'Turn the provider on first')
    }
    A.ai = {
      ...A.ai,
      ...req,
      featureModels: { ...A.ai.featureModels, ...req.featureModels },
      policy: { ...A.ai.policy, ...req.policy },
    }
    if (req.policy?.localOnly) {
      A.ai.providers.forEach((p) => (p.enabled = p.id === 'local'))
      A.ai.defaultProvider = 'local'
    }
    const what = Object.keys(req)
      .map((k) =>
        k === 'budget'
          ? `monthly budget to $${req.budget}`
          : k === 'warnAt'
            ? `budget warning to ${req.warnAt}%`
            : k === 'defaultProvider'
              ? `default provider to ${req.defaultProvider}`
              : k === 'featureModels'
                ? 'per-feature models'
                : 'data rules',
      )
      .join(', ')
    audit('AI', `Changed ${what}`)
    return json<AiSettings>(A.ai)
  }),

  http.patch(api('/admin/ai/providers/:prov'), async ({ params, request }) => {
    await latency(120)
    const req = await body<UpdateAiProviderRequest>(request)
    const p = A.ai.providers.find((x) => x.id === params.prov)
    if (!p) return fail(404, 'not_found', 'Provider not found')
    if (req.enabled === true && p.needsKey && !p.keySet && !req.key)
      return fail(400, 'no_key', `Add an API key for ${p.name} first`)
    if (
      req.enabled === false &&
      A.ai.defaultProvider === p.id &&
      A.ai.providers.filter((x) => x.enabled).length > 1
    ) {
      A.ai.defaultProvider = A.ai.providers.find((x) => x.enabled && x.id !== p.id)!.id
    }
    if (req.enabledModels) {
      if (!req.enabledModels.length)
        return fail(400, 'validation', 'Keep at least one model, or turn the provider off')
      p.enabledModels = req.enabledModels
      if (!p.enabledModels.includes(p.defaultModel)) p.defaultModel = p.enabledModels[0]!
    }
    if (req.defaultModel) p.defaultModel = req.defaultModel
    if (req.enabled !== undefined) p.enabled = req.enabled
    if (req.key !== undefined) {
      if (req.key) A.aiKeys[p.id] = req.key
      else delete A.aiKeys[p.id]
      p.keySet = !!req.key
      audit('AI', `${req.key ? 'Replaced' : 'Removed'} the ${p.name} API key`)
    } else audit('AI', `Updated ${p.name}`)
    return json<AiSettings>(A.ai)
  }),

  http.post(api('/admin/ai/mcp'), async ({ request }) => {
    await latency()
    const req = await body<{ name: string; url: string }>(request)
    if (!req.name?.trim())
      return fail(400, 'validation', 'Name the server', [{ path: 'name', problem: 'required' }])
    if (!/^https?:\/\/\S+$/.test(req.url ?? ''))
      return fail(400, 'validation', 'Enter an http(s) URL', [{ path: 'url', problem: 'invalid' }])
    const m: McpServer = {
      id: `mcp_${Date.now().toString(36)}`,
      name: req.name.trim(),
      url: req.url.trim(),
      enabled: true,
    }
    A.ai.mcp.push(m)
    audit('AI', `Added tool server ${m.name}`)
    return json<AiSettings>(A.ai, { status: 201 })
  }),

  http.patch(api('/admin/ai/mcp/:mid'), async ({ params, request }) => {
    await latency(90)
    const req = await body<{ enabled: boolean }>(request)
    const m = A.ai.mcp.find((x) => x.id === params.mid)
    if (!m) return fail(404, 'not_found', 'Server not found')
    m.enabled = req.enabled
    audit('AI', `Turned ${m.enabled ? 'on' : 'off'} ${m.name} tools`)
    return json<AiSettings>(A.ai)
  }),

  http.delete(api('/admin/ai/mcp/:mid'), async ({ params }) => {
    await latency()
    const m = A.ai.mcp.find((x) => x.id === params.mid)
    if (!m) return fail(404, 'not_found', 'Server not found')
    A.ai.mcp = A.ai.mcp.filter((x) => x.id !== m.id)
    audit('AI', `Removed tool server ${m.name}`)
    return json<AiSettings>(A.ai)
  }),

  // ── Databases ─────────────────────────────────────────────────────────────────────
  http.get(api('/admin/databases'), async () => {
    await latency()
    return json<DatabasesResponse>(A.databases)
  }),

  http.post(api('/admin/databases'), async ({ request }) => {
    await latency(500)
    const req = await body<CreateDatabaseRequest>(request)
    const name = (req.name ?? '').trim()
    if (!/^[a-z][a-z0-9_]{1,62}$/.test(name))
      return fail(400, 'validation', 'Use lowercase letters, digits and _ (start with a letter)', [
        { path: 'name', problem: 'invalid' },
      ])
    if (A.databases.databases.some((d) => d.name === name))
      return fail(409, 'exists', `${name} already exists`)
    const d: ManagedDatabase = {
      name,
      engine: req.engine,
      project: req.project,
      env: req.env,
      sizeBytes: 0,
      backup: 'daily',
    }
    A.databases.databases.push(d)
    audit('Databases', `Created database ${name}`)
    return json<DatabasesResponse>(A.databases, { status: 201 })
  }),

  http.patch(api('/admin/databases/:name'), async ({ params, request }) => {
    await latency(90)
    const req = await body<Pick<ManagedDatabase, 'backup'>>(request)
    const d = A.databases.databases.find((x) => x.name === params.name)
    if (!d) return fail(404, 'not_found', 'Database not found')
    d.backup = req.backup
    audit('Databases', `Backups for ${d.name} set to ${req.backup}`)
    return json<DatabasesResponse>(A.databases)
  }),

  http.post(api('/admin/databases/:name/backup'), async ({ params }) => {
    await latency(400)
    const d = A.databases.databases.find((x) => x.name === params.name)
    if (!d) return fail(404, 'not_found', 'Database not found')
    audit('Databases', `Started a backup of ${d.name}`)
    return new HttpResponse(null, { status: 202 })
  }),

  http.post(api('/admin/databases/engines/:eid/restart'), async ({ params }) => {
    await latency(900)
    const e = A.databases.engines.find((x) => x.id === params.eid)
    if (!e) return fail(404, 'not_found', 'Engine not found')
    e.running = true
    audit('Databases', `Restarted ${e.name}`)
    return json<DatabasesResponse>(A.databases)
  }),

  // ── Sandboxes ─────────────────────────────────────────────────────────────────────
  http.get(api('/admin/sandboxes'), async () => {
    await latency()
    return HttpResponse.json({ items: A.sandboxes.map(sandboxView) })
  }),

  http.put(api('/admin/sandboxes/:sid'), async ({ params, request }) => {
    await latency(300)
    const req = await body<UpdateSandboxRequest>(request)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    if (!Number.isInteger(req.run?.port) || req.run.port < 1 || req.run.port > 65535)
      return fail(400, 'validation', 'Port must be between 1 and 65535', [
        { path: 'run.port', problem: 'invalid' },
      ])
    if (req.source === 'git' && !/^(https?:\/\/|git@)\S+$/.test(req.git?.url ?? ''))
      return fail(400, 'validation', 'Enter a repository URL (HTTPS or SSH)', [
        { path: 'git.url', problem: 'invalid' },
      ])
    const keys = req.env.map((e) => e.key)
    if (keys.some((k) => !/^[A-Z][A-Z0-9_]*$/.test(k)))
      return fail(400, 'validation', 'Variable names use UPPER_SNAKE_CASE', [
        { path: 'env', problem: 'invalid' },
      ])
    if (new Set(keys).size !== keys.length)
      return fail(400, 'validation', 'Variable names must be unique', [{ path: 'env', problem: 'duplicate' }])
    const secrets = (A.sandboxSecrets[s.id] ??= {})
    const env = req.env.map((e) => {
      if (!e.secret) {
        delete secrets[e.id]
        return { id: e.id, key: e.key, secret: false, value: e.value ?? '' }
      }
      if (e.value !== undefined) secrets[e.id] = e.value
      return { id: e.id, key: e.key, secret: true, set: !!secrets[e.id] }
    })
    for (const id of Object.keys(secrets))
      if (id !== '__git' && !env.some((e) => e.id === id)) delete secrets[id]
    if (req.gitToken !== undefined) {
      if (req.gitToken) secrets.__git = req.gitToken
      else delete secrets.__git
    }
    const { gitToken: _token, ...config } = req
    void _token
    Object.assign(s, config, {
      env,
      git: { ...config.git, tokenSet: !!secrets.__git, publicKey: s.git.publicKey },
    })
    audit('Sandboxes', `Changed ${s.id} sandbox settings`)
    return json<Sandbox>(sandboxView(s))
  }),

  http.post(api('/admin/sandboxes/:sid/test'), async ({ params, request }) => {
    await latency(900)
    const req = await body<UpdateSandboxRequest>(request)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    const g = req.git ?? s.git
    const ok = /^(https?:\/\/|git@)\S+/.test(g.url)
    const auth =
      g.auth === 'public' ? 'no credentials' : g.auth === 'token' ? 'token accepted' : 'deploy key accepted'
    const lines = ok
      ? [
          { ok: true, text: `Repository reachable · ${auth}` },
          { ok: !!g.ref, text: g.ref ? `Found ${g.refType} ${g.ref}` : `No ${g.refType} set` },
          {
            ok: true,
            text:
              s.id === 'frontend'
                ? 'package.json, vite.config.ts, src/pages, src/components'
                : 'package.json, nest-cli.json, src/functions, src/apis',
          },
          { ok: true, text: 'platon.sandbox.json · schema v1' },
        ]
      : [{ ok: false, text: 'Can’t reach the repository. Check the URL and access.' }]
    return json<SandboxTestResult>({ ok: lines.every((l) => l.ok), lines })
  }),

  http.post(api('/admin/sandboxes/:sid/update'), async ({ params, request }) => {
    await latency(700)
    const req = await body<{ rollout: SandboxRollout }>(request)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    if (!s.latest) return fail(400, 'up_to_date', 'Already on the latest version')
    const l = s.latest
    const rollout =
      req.rollout === 'all'
        ? 'All projects · rebuild tonight'
        : req.rollout === 'choose'
          ? 'Owners choose'
          : 'New projects only'
    s.history.unshift({
      version: l.version,
      at: new Date().toISOString(),
      by: ME.name,
      note: `${rollout} · ${l.diff.map((d) => `${d.name} ${d.to}`).join(', ')}`,
    })
    for (const d of l.diff) {
      const row = s.stack.find((x) => x.name === d.name)
      if (row) row.version = d.to
    }
    // Pin current project versions so only "all" moves existing projects.
    const before = sandboxView(s).projects
    s.version = l.version
    s.commit = l.commit
    s.appliedAt = new Date().toISOString()
    s.appliedBy = ME.name
    s.latest = null
    for (const p of before)
      setProjectVersion(s.id, p.projectId, req.rollout === 'all' ? l.version : p.version)
    audit('Sandboxes', `Updated ${s.id} sandbox to v${l.version} (${rollout})`)
    return json<Sandbox>(sandboxView(s))
  }),

  http.post(api('/admin/sandboxes/:sid/rollback'), async ({ params, request }) => {
    await latency(500)
    const req = await body<{ version: string }>(request)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    if (!s.history.some((h) => h.version === req.version))
      return fail(404, 'not_found', 'Version not in history')
    s.version = req.version
    s.appliedAt = new Date().toISOString()
    s.appliedBy = ME.name
    audit('Sandboxes', `Rolled back ${s.id} sandbox to v${req.version}`)
    return json<Sandbox>(sandboxView(s))
  }),

  http.post(api('/admin/sandboxes/:sid/projects/:pid/update'), async ({ params }) => {
    await latency(400)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    setProjectVersion(s.id, String(params.pid), s.version)
    save()
    audit('Sandboxes', `Rebuilt ${params.pid} on ${s.id} sandbox v${s.version}`)
    return json<Sandbox>(sandboxView(s))
  }),

  http.post(api('/admin/sandboxes/:sid/restart'), async ({ params }) => {
    await latency(600)
    const s = A.sandboxes.find((x) => x.id === params.sid)
    if (!s) return fail(404, 'not_found', 'Sandbox not found')
    s.running = true
    audit('Sandboxes', `Restarted all ${s.id} sandboxes`)
    return json<Sandbox>(sandboxView(s))
  }),

  // ── Modules ───────────────────────────────────────────────────────────────────────
  http.get(api('/admin/modules'), async () => {
    await latency()
    return HttpResponse.json<{ items: AdminModuleGroup[] }>({ items: A.modules })
  }),

  http.patch(api('/admin/modules/:gid/:mid'), async ({ params, request }) => {
    await latency(90)
    const req = await body<{ enabled: boolean }>(request)
    const g = A.modules.find((x) => x.id === params.gid)
    const m = g?.items.find((x) => x.id === params.mid)
    if (!g || !m) return fail(404, 'not_found', 'Module not found')
    if (!req.enabled && g.keepOne && g.items.filter((x) => x.enabled).length <= 1)
      return fail(400, 'keep_one', `Keep at least one of: ${g.label.toLowerCase()}`)
    m.enabled = req.enabled
    audit('Modules', `Turned ${m.enabled ? 'on' : 'off'} ${m.label} for all projects`)
    return HttpResponse.json<{ items: AdminModuleGroup[] }>({ items: A.modules })
  }),

  // ── Audit ─────────────────────────────────────────────────────────────────────────
  http.get(api('/admin/audit'), async ({ request }) => {
    await latency()
    const u = new URL(request.url)
    const area = u.searchParams.get('area')
    const q = (u.searchParams.get('q') ?? '').toLowerCase()
    const items = A.audit.filter(
      (e) => (!area || e.area === area) && (!q || `${e.who} ${e.text}`.toLowerCase().includes(q)),
    )
    return HttpResponse.json({ items, total: items.length })
  }),
]
