/**
 * Mock handlers — releases, deployments, tests and the Development console shell (requirements §3.7, §6.1).
 * Deployments are jobs whose steps advance with wall-clock time, so polling shows real progress.
 */
import { http } from 'msw'
import {
  getAt,
  type AppDefinition,
  type CreateReleaseRequest,
  type Deployment,
  type DeploymentJob,
  type DeployResponse,
  type DeployStep,
  type DeployStepId,
  type EnvironmentState,
  type EnvName,
  type Release,
  type ReleaseDetailResponse,
  type ReleasePreviewResponse,
  type ReleasesResponse,
  type RollbackResponse,
  type RunTestsRequest,
  type RunTestsResponse,
  type ShellCallRequest,
  type ShellCallResponse,
  type ShellQueryRequest,
  type ShellQueryResponse,
  type TestsResponse,
  type TypedField,
} from '@platon/definition'
import { validateAll } from '@platon/validators'
import { db, ext, persist, project, type ProjectState } from '../db'
import { ME } from '../seed'
import {
  demoSchemaChanges,
  generateMigrations,
  generateProvisioning,
  nextReleaseName,
  seedReleaseHistory,
  seedTests,
  snapshotOf,
  type ReleaseHistoryEntry,
  type SchemaSnapshot,
} from '../seed/releases'
import { action, api, body, fail, json, latency, withProject } from '../http'

const ENVS: EnvName[] = ['development', 'staging', 'production']
const ENV_LABEL: Record<EnvName, string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
}
const STEP_MS = 1100

interface EnvSlot {
  releaseId: string | null
  status: EnvironmentState['status']
  at: string | null
  by: string | null
  jobId: string | null
  pending: EnvironmentState['pending']
}

interface JobState {
  job: DeploymentJob
  startedMs: number
  /** Step that fails (validation errors), if any. */
  failAt?: DeployStepId
  finalized?: boolean
}

interface ReleasesExt {
  /** Data + storage as last released — the "before" side of the migration diff. */
  baseline: SchemaSnapshot
  history: Record<string, ReleaseHistoryEntry>
  envs: Record<EnvName, EnvSlot>
  jobs: Record<string, JobState>
}

function initialEnvs(releases: Release[]): Record<EnvName, EnvSlot> {
  const out = {} as Record<EnvName, EnvSlot>
  for (const env of ENVS) {
    let best: { r: Release; d: Deployment } | null = null
    for (const r of releases)
      for (const d of r.deployments)
        if (d.env === env && d.status === 'succeeded' && (!best || (d.at ?? '') > (best.d.at ?? '')))
          best = { r, d }
    out[env] = {
      releaseId: best?.r.id ?? null,
      status: best ? 'succeeded' : 'idle',
      at: best?.d.at ?? null,
      by: best?.d.by ?? best?.r.createdBy ?? null,
      jobId: null,
      pending: null,
    }
  }
  return out
}

/** Lazily set up release state; on first use the FieldOps demo gets pending Data/Storage edits. */
function state(pid: string): ReleasesExt {
  const p = project(pid)!
  return ext<ReleasesExt>(pid, 'releases', () => {
    const baseline = snapshotOf(p.definition)
    if (pid === 'fieldops') {
      const demo = demoSchemaChanges()
      p.definition = demo.apply(p.definition)
      for (const c of demo.changes) if (!p.changes.some((x) => x.id === c.id)) p.changes.push(c)
    }
    persist()
    return {
      baseline,
      history: pid === 'fieldops' ? seedReleaseHistory() : {},
      envs: initialEnvs(p.releases),
      jobs: {},
    }
  })
}

// Seed before the Studio loads the definition, so the client sees the same working copy.
for (const pid of Object.keys(db.state)) if (pid === 'fieldops') state(pid)

const pendingChanges = (p: ProjectState) => p.changes.filter((c) => !c.releaseId)

function preview(p: ProjectState, s: ReleasesExt): ReleasePreviewResponse {
  return {
    suggestedName: nextReleaseName(p.releases.map((r) => r.name)),
    changeCount: pendingChanges(p).length,
    migrations: generateMigrations(s.baseline.data, p.definition.data, p.definition.version + 1),
    provisioning: generateProvisioning(s.baseline.storage, p.definition.storage),
  }
}

function environments(p: ProjectState, s: ReleasesExt): EnvironmentState[] {
  return ENVS.map((env) => {
    const slot = s.envs[env]
    const r = p.releases.find((x) => x.id === slot.releaseId)
    return {
      env,
      releaseId: slot.releaseId,
      releaseName: r?.name ?? null,
      status: slot.status,
      at: slot.at,
      by: slot.by,
      pending: slot.pending,
      jobId: slot.jobId,
    }
  })
}

const STEP_LABELS: Record<DeployStepId, string> = {
  validate: 'Check definition',
  migrations: 'Run database migrations',
  provisioning: 'Provision storage',
  deploy: 'Switch to the new definition',
}

/** Recompute a job's steps from elapsed time; finalize env state once it ends. */
function advance(p: ProjectState, s: ReleasesExt, js: JobState): DeploymentJob {
  const job = js.job
  if (job.status === 'awaiting_approval' || js.finalized) return job
  const hist = s.history[job.releaseId]
  const elapsed = Date.now() - js.startedMs
  const done = Math.floor(elapsed / STEP_MS)
  const ids: DeployStepId[] = ['validate', 'migrations', 'provisioning', 'deploy']
  let failed = false
  job.steps = ids.map((id, i): DeployStep => {
    const empty =
      (id === 'migrations' && !hist?.migrations.length) ||
      (id === 'provisioning' && !hist?.provisioning.length)
    const detail =
      id === 'validate'
        ? js.failAt === 'validate'
          ? 'Errors in the definition — fix them in Problems'
          : 'No blocking problems'
        : id === 'migrations'
          ? empty
            ? 'No schema changes'
            : `${hist!.migrations.length} migration${hist!.migrations.length === 1 ? '' : 's'} · records kept`
          : id === 'provisioning'
            ? empty
              ? 'Nothing to provision'
              : `${hist!.provisioning.length} storage change${hist!.provisioning.length === 1 ? '' : 's'}`
            : `${job.releaseName} is live on ${ENV_LABEL[job.env]}`
    if (failed) return { id, label: STEP_LABELS[id], status: 'pending' }
    if (i < done) {
      if (js.failAt === id) {
        failed = true
        return { id, label: STEP_LABELS[id], status: 'failed', detail }
      }
      return { id, label: STEP_LABELS[id], status: empty ? 'skipped' : 'done', detail }
    }
    if (i === done) return { id, label: STEP_LABELS[id], status: 'running' }
    return { id, label: STEP_LABELS[id], status: 'pending' }
  })
  const slot = s.envs[job.env]
  if (failed || done >= ids.length) {
    js.finalized = true
    job.finishedAt = new Date().toISOString()
    job.status = failed ? 'failed' : 'succeeded'
    if (failed) job.error = 'Release blocked: the definition has errors.'
    const r = p.releases.find((x) => x.id === job.releaseId)
    if (r) {
      r.deployments = [
        ...r.deployments.filter((d) => d.env !== job.env),
        { env: job.env, status: job.status, at: job.finishedAt, by: job.by },
      ]
    }
    if (!failed)
      Object.assign(slot, { releaseId: job.releaseId, status: 'succeeded', at: job.finishedAt, by: job.by })
    else slot.status = 'failed'
    slot.jobId = null
    persist()
  }
  return job
}

function newJob(release: Release, env: EnvName, status: DeploymentJob['status']): DeploymentJob {
  return {
    id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    releaseId: release.id,
    releaseName: release.name,
    env,
    status,
    steps: (['validate', 'migrations', 'provisioning', 'deploy'] as DeployStepId[]).map((id) => ({
      id,
      label: STEP_LABELS[id],
      status: 'pending',
    })),
    startedAt: new Date().toISOString(),
    by: ME.name,
  }
}

const canApprove = () => ME.role === 'owner' || ME.role === 'admin'

// ---- Console shell helpers ------------------------------------------------------------------

function sample(f: TypedField | { type: string; fields?: TypedField[] }): unknown {
  const t = f.type
  if (t === 'datetime') return new Date(Date.now() + 4 * 3_600_000).toISOString()
  if (t === 'date') return new Date().toISOString().slice(0, 10)
  if (t === 'boolean') return true
  if (t === 'number' || t === 'integer') return 42
  if (t === 'string') return 'ok'
  if (t.startsWith('array')) return []
  if (t === 'object' && f.fields) return Object.fromEntries(f.fields.map((x) => [x.name, sample(x)]))
  return null
}

function findFunction(def: AppDefinition, name: string) {
  return def.logic.functions.find((f) => f.name === name || f.id === name)
}

export const releasesHandlers = [
  http.get(api('/projects/:id/releases'), async ({ params }) => {
    await latency(120)
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      for (const js of Object.values(s.jobs)) advance(p, s, js)
      return json<ReleasesResponse>({ items: p.releases, environments: environments(p, s) })
    })
  }),

  http.get(api('/projects/:id/releases/preview'), async ({ params }) => {
    await latency(160)
    return withProject(params.id, (p, pid) => json<ReleasePreviewResponse>(preview(p, state(pid))))
  }),

  http.post(api('/projects/:id/releases'), async ({ params, request }) => {
    await latency(220)
    const req = await body<CreateReleaseRequest>(request)
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const name = (req.name ?? '').trim()
      if (!name)
        return fail(422, 'invalid', 'Give the release a name', [{ path: 'name', problem: 'required' }])
      if (p.releases.some((r) => r.name === name))
        return fail(409, 'duplicate', `A release named ${name} already exists`)
      const pending = pendingChanges(p)
      if (!pending.length) return fail(422, 'empty', 'Nothing to release yet')
      if (validateAll(p.definition).some((x) => x.severity === 'error'))
        return fail(422, 'blocked', 'Fix the errors in Problems before releasing')
      const pv = preview(p, s)
      const id = `rel_${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${Date.now().toString(36)}`
      const release: Release = {
        id,
        name,
        ...(req.note ? { note: req.note } : {}),
        fromVersion: p.releases[0]?.toVersion ?? 0,
        toVersion: p.definition.version,
        changes: pending.map((c) => c.id),
        migrations: pv.migrations.map((m) => m.file),
        deployments: [],
        createdAt: new Date().toISOString(),
        createdBy: ME.name,
      }
      p.changes = p.changes.map((c) => (c.releaseId ? c : { ...c, releaseId: id }))
      s.history[id] = {
        changes: pending.map((c) => ({ ...c, releaseId: id })),
        migrations: pv.migrations,
        provisioning: pv.provisioning,
      }
      s.baseline = snapshotOf(p.definition)
      p.releases.unshift(release)
      persist()
      return json(release, { status: 201 })
    })
  }),

  http.get(api('/projects/:id/releases/:rid'), async ({ params }) => {
    await latency(120)
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const r = p.releases.find((x) => x.id === params.rid)
      if (!r) return fail(404, 'not_found', 'Release not found')
      const h = s.history[r.id]
      const changes = h?.changes ?? p.changes.filter((c) => c.releaseId === r.id)
      return json<ReleaseDetailResponse>({
        release: r,
        changes,
        migrations: h?.migrations ?? [],
        provisioning: h?.provisioning ?? [],
      })
    })
  }),

  http.post(api('/projects/:id/releases/:rid'), async ({ params, request }) => {
    await latency(200)
    const [rid, verb] = action(params.rid)
    const env = new URL(request.url).searchParams.get('env') as EnvName | null
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const r = p.releases.find((x) => x.id === rid)
      if (!r) return fail(404, 'not_found', 'Release not found')
      if (!env || !ENVS.includes(env)) return fail(400, 'bad_env', 'Choose an environment')
      const slot = s.envs[env]

      if (verb === 'deploy') {
        if (
          slot.jobId &&
          s.jobs[slot.jobId] &&
          !s.jobs[slot.jobId]!.finalized &&
          s.jobs[slot.jobId]!.job.status === 'running'
        )
          return fail(409, 'busy', `${ENV_LABEL[env]} is already deploying`)
        if (env === 'production' && !canApprove()) {
          const job = newJob(r, env, 'awaiting_approval')
          s.jobs[job.id] = { job, startedMs: Date.now() }
          slot.pending = { releaseId: r.id, releaseName: r.name, requestedBy: ME.name, at: job.startedAt }
          r.deployments = [
            ...r.deployments.filter((d) => d.env !== env),
            { env, status: 'awaiting_approval', at: job.startedAt, by: ME.name },
          ]
          persist()
          return json<DeployResponse>({ job })
        }
        const job = newJob(r, env, 'running')
        const errors = validateAll(p.definition).some((x) => x.severity === 'error')
        s.jobs[job.id] = { job, startedMs: Date.now(), ...(errors ? { failAt: 'validate' as const } : {}) }
        if (slot.pending?.releaseId === r.id) slot.pending = null
        slot.jobId = job.id
        slot.status = 'running'
        r.deployments = [
          ...r.deployments.filter((d) => d.env !== env),
          { env, status: 'running', at: job.startedAt, by: ME.name },
        ]
        persist()
        return json<DeployResponse>({ job: advance(p, s, s.jobs[job.id]!) })
      }

      if (verb === 'rollback') {
        if (env === 'production' && !canApprove())
          return fail(403, 'forbidden', 'Only an Owner or Admin can roll back Production')
        const current = p.releases.find((x) => x.id === slot.releaseId)
        if (current && current.id !== r.id)
          current.deployments = current.deployments.map((d) =>
            d.env === env ? { ...d, status: 'rolled_back' } : d,
          )
        const at = new Date().toISOString()
        r.deployments = [
          ...r.deployments.filter((d) => d.env !== env),
          { env, status: 'succeeded', at, by: ME.name },
        ]
        Object.assign(slot, { releaseId: r.id, status: 'succeeded', at, by: ME.name, jobId: null })
        persist()
        return json<RollbackResponse>({ environments: environments(p, s) })
      }
      return fail(400, 'unknown_action', `Unknown action ${verb ?? ''}`)
    })
  }),

  http.get(api('/projects/:id/deployments/:jobId'), async ({ params }) => {
    await latency(60)
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const js = s.jobs[String(params.jobId)]
      if (!js) return fail(404, 'not_found', 'Deployment not found')
      return json<DeployResponse>({ job: advance(p, s, js) })
    })
  }),

  // ---- Tests ----------------------------------------------------------------------------------
  http.get(api('/projects/:id/tests'), async ({ params }) => {
    await latency(100)
    return withProject(params.id, (p) =>
      json<TestsResponse>({
        items: seedTests(p.definition).map(({ id, group, kind, name }) => ({ id, group, kind, name })),
      }),
    )
  }),

  http.post(api('/projects/:id/test-runs'), async ({ params, request }) => {
    const req = await body<RunTestsRequest>(request)
    await latency(700)
    return withProject(params.id, (p) => {
      const all = seedTests(p.definition)
      const want = req.ids?.length ? all.filter((t) => req.ids!.includes(t.id)) : all
      return json<RunTestsResponse>({
        results: want.map((t) => ({
          id: t.id,
          status: t.fails ? 'fail' : 'pass',
          ms: t.ms + Math.round(Math.random() * 8),
          ...(t.fails ? { error: t.fails } : {}),
        })),
        ranAt: new Date().toISOString(),
      })
    })
  }),

  // ---- Console shell (Development data only) -------------------------------------------------
  http.post(api('/projects/:id/shell/call'), async ({ params, request }) => {
    const req = await body<ShellCallRequest>(request)
    await latency(150)
    return withProject(params.id, (p) => {
      const fn = findFunction(p.definition, req.fn)
      if (!fn) return fail(404, 'not_found', `Function not found: ${req.fn}`)
      const missing = fn.params.filter((x) => x.req && !(x.name in (req.args ?? {}))).map((x) => x.name)
      if (missing.length)
        return fail(
          422,
          'invalid_args',
          `Missing argument${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
        )
      const result =
        fn.returns.type === 'object'
          ? sample({ type: 'object', fields: fn.returns.fields ?? [] })
          : sample({ type: fn.returns.type })
      return json<ShellCallResponse>({
        result,
        ms: 20 + Math.round(Math.random() * 80),
        logs: fn.steps
          .slice(0, 3)
          .map((st, i) => `step ${i + 1} · ${st.type}${st.note ? ` — ${st.note}` : ''}`),
      })
    })
  }),

  http.post(api('/projects/:id/shell/query'), async ({ params, request }) => {
    const req = await body<ShellQueryRequest>(request)
    await latency(120)
    return withProject(params.id, (p) => {
      const sql = (req.sql ?? '').trim().replace(/;$/, '')
      const m =
        /^select\s+(.+?)\s+from\s+"?([a-z0-9_]+)"?(?:\s+where\s+(.+?))?(?:\s+limit\s+(\d+))?$/i.exec(sql) ??
        /^()([a-z0-9_]+)()()$/i.exec(sql)
      if (!m)
        return fail(
          400,
          'syntax',
          "Only SELECT … FROM <table> [WHERE col = 'value'] [LIMIT n] is supported in the console",
        )
      const table = m[2]!
      let rows = p.records[table]
      if (!rows) return fail(404, 'not_found', `Table not found: ${table}`)
      if (m[3]) {
        const w = /^([a-z0-9_]+)\s*=\s*'?([^']*)'?$/i.exec(m[3].trim())
        if (!w) return fail(400, 'syntax', "WHERE supports one condition: col = 'value'")
        rows = rows.filter((r) => String(r[w[1]!] ?? '') === w[2])
      }
      const limit = m[4] ? Number(m[4]) : 20
      const sel = m[1]?.trim()
      const cols = !sel || sel === '*' ? Object.keys(rows[0] ?? {}) : sel.split(',').map((c) => c.trim())
      return json<ShellQueryResponse>({
        columns: cols,
        rows: rows
          .slice(0, limit)
          .map((r) => Object.fromEntries(cols.map((c) => [c, getAt(r, `/${c}`) ?? null]))),
        total: rows.length,
        ms: 3 + Math.round(Math.random() * 12),
      })
    })
  }),
]
