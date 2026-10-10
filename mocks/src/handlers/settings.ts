/** Mock handlers — project settings stored outside the definition (auth providers, git, CI/CD, Agent.md, AI translate). */
import { http, HttpResponse } from 'msw'
import {
  AUTH_PROVIDER_IDS,
  type AgentDoc,
  type AiTranslateRequest,
  type AiTranslateResponse,
  type AuthProviderId,
  type AuthSettings,
  type CiResponse,
  type CiRun,
  type GitCommit,
  type GitResponse,
  type PutCiVariableRequest,
  type UpdateAuthProviderRequest,
  type UpdateAuthSettingsRequest,
  type UpdateGitRequest,
} from '@platon/definition'
import { db, ext, persist } from '../db'
import { ME } from '../seed'
import { PHRASES, seedAgent, seedAuth, seedCi, seedGit, type AuthState, type CiState } from '../seed/settings'
import { api, body, fail, json, latency, withProject } from '../http'

const auth = (pid: string) => ext<AuthState>(pid, 'settings.auth', () => seedAuth(pid))
const git = (pid: string) => ext<GitResponse>(pid, 'settings.git', () => seedGit(pid))
const ci = (pid: string) =>
  ext<CiState>(pid, 'settings.ci', () => {
    const p = db.state[pid]!.definition
    return seedCi(pid, p.settings.slug ?? pid, p.settings.timezone)
  })
const agent = (pid: string) =>
  ext<AgentDoc>(pid, 'settings.agent', () => seedAgent(db.state[pid]!.definition.name))

const isProvider = (x: unknown): x is AuthProviderId => AUTH_PROVIDER_IDS.includes(x as AuthProviderId)

function ciView(s: CiState): CiResponse {
  // Running runs finish ~3 s after they start; a run that needs Owner approval stops at "waiting".
  const now = Date.now()
  for (const r of s.runs) {
    if (r.status === 'running' && now - Date.parse(r.at) > 3000) {
      r.status = s.config.stages.approval ? 'waiting' : 'passed'
      r.detail = s.config.stages.approval ? 'Waiting for Owner approval' : '2m 48s'
    }
  }
  return { config: s.config, runs: s.runs, variables: s.variables }
}

function fakeTranslate(lang: string, text: string): string {
  const book = PHRASES[lang]
  if (book?.[text]) return book[text]
  return `${text} [${lang}]`
}

export const settingsHandlers = [
  // ── Sign-in & security ────────────────────────────────────────────────────────────
  http.get(api('/projects/:id/auth'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => json<AuthSettings>(auth(pid).settings))
  }),

  http.patch(api('/projects/:id/auth'), async ({ params, request }) => {
    await latency()
    const req = await body<UpdateAuthSettingsRequest>(request)
    return withProject(params.id, (_p, pid) => {
      const s = auth(pid)
      if (req.allowedDomains?.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)))
        return fail(400, 'validation', 'Enter domains like acme.com, separated by commas', [
          { path: 'allowedDomains', problem: 'invalid' },
        ])
      s.settings = { ...s.settings, ...req, methods: { ...s.settings.methods, ...req.methods } }
      persist()
      return json<AuthSettings>(s.settings)
    })
  }),

  http.patch(api('/projects/:id/auth/providers/:provider'), async ({ params, request }) => {
    await latency()
    const req = await body<UpdateAuthProviderRequest>(request)
    return withProject(params.id, (_p, pid) => {
      if (!isProvider(params.provider)) return fail(404, 'not_found', 'Unknown provider')
      const s = auth(pid)
      const prov = s.settings.providers[params.provider]
      if (req.fields) prov.fields = { ...prov.fields, ...req.fields }
      if (req.defaultRole) prov.defaultRole = req.defaultRole
      for (const [k, v] of Object.entries(req.secrets ?? {})) {
        const store = (s.secretValues[params.provider] ??= {})
        if (v) store[k] = v
        else delete store[k]
        prov.secrets[k] = !!v
      }
      persist()
      return json<AuthSettings>(s.settings)
    })
  }),

  // ── Git ───────────────────────────────────────────────────────────────────────────
  http.get(api('/projects/:id/git'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => json<GitResponse>(git(pid)))
  }),

  http.patch(api('/projects/:id/git'), async ({ params, request }) => {
    await latency(90)
    const req = await body<UpdateGitRequest>(request)
    return withProject(params.id, (_p, pid) => {
      const g = git(pid)
      g.config = { ...g.config, ...req }
      persist()
      return json<GitResponse>(g)
    })
  }),

  http.post(api('/projects/:id/git/connect'), async ({ params, request }) => {
    await latency(700)
    const req = await body<UpdateGitRequest>(request)
    return withProject(params.id, (_p, pid) => {
      const g = git(pid)
      const next = { ...g.config, ...req }
      if (!/^[\w.-]+\/[\w.-]+$/.test(next.repo ?? ''))
        return fail(400, 'validation', 'Repository should look like owner/name', [
          { path: 'repo', problem: 'invalid' },
        ])
      if (!next.branch?.trim())
        return fail(400, 'validation', 'Choose a branch', [{ path: 'branch', problem: 'required' }])
      g.config = { ...next, connected: true, lastSyncAt: new Date().toISOString() }
      persist()
      return json<GitResponse>(g)
    })
  }),

  http.post(api('/projects/:id/git/disconnect'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => {
      const g = git(pid)
      g.config = { ...g.config, connected: false }
      persist()
      return json<GitResponse>(g)
    })
  }),

  /** Push unreleased changes — as a pull request when `openPr` is on. */
  http.post(api('/projects/:id/git/push'), async ({ params }) => {
    await latency(600)
    return withProject(params.id, (p, pid) => {
      const g = git(pid)
      if (!g.config.connected) return fail(400, 'not_connected', 'Connect a repository first')
      const n = p.changes.filter((c) => !c.releaseId).length
      if (!n) return fail(400, 'nothing_to_push', 'Nothing new to push')
      const c: GitCommit = {
        hash: Math.random().toString(16).slice(2, 9),
        message: g.config.openPr
          ? `Studio: ${n} unreleased change${n === 1 ? '' : 's'} (pull request #${18 + g.commits.length})`
          : `Studio: ${n} unreleased change${n === 1 ? '' : 's'}`,
        by: ME.name,
        at: new Date().toISOString(),
      }
      g.commits.unshift(c)
      g.config.lastSyncAt = c.at
      persist()
      return json<GitResponse>(g)
    })
  }),

  // ── CI/CD ─────────────────────────────────────────────────────────────────────────
  http.get(api('/projects/:id/ci'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => json<CiResponse>(ciView(ci(pid))))
  }),

  http.patch(api('/projects/:id/ci'), async ({ params, request }) => {
    await latency(90)
    const req = await body<Partial<CiResponse['config']>>(request)
    return withProject(params.id, (_p, pid) => {
      const s = ci(pid)
      s.config = { trigger: req.trigger ?? s.config.trigger, stages: { ...s.config.stages, ...req.stages } }
      persist()
      return json<CiResponse>(ciView(s))
    })
  }),

  http.post(api('/projects/:id/ci/runs'), async ({ params }) => {
    await latency(250)
    return withProject(params.id, (_p, pid) => {
      const s = ci(pid)
      if (!Object.values(s.config.stages).some(Boolean))
        return fail(400, 'empty_pipeline', 'Turn on at least one stage first')
      const run: CiRun = {
        n: (s.runs[0]?.n ?? 0) + 1,
        title: 'Manual run · Development',
        status: 'running',
        detail: 'Started by ' + ME.name,
        at: new Date().toISOString(),
      }
      s.runs.unshift(run)
      persist()
      return json<CiResponse>(ciView(s), { status: 201 })
    })
  }),

  http.put(api('/projects/:id/ci/variables/:key'), async ({ params, request }) => {
    await latency()
    const req = await body<PutCiVariableRequest>(request)
    return withProject(params.id, (_p, pid) => {
      const key = String(params.key)
      if (!/^[A-Z][A-Z0-9_]*$/.test(key))
        return fail(400, 'validation', 'Use UPPER_SNAKE_CASE names', [{ path: 'key', problem: 'invalid' }])
      const s = ci(pid)
      let v = s.variables.find((x) => x.key === key)
      if (!v) {
        v = { key, secret: req.secret }
        s.variables.push(v)
      }
      v.secret = req.secret
      if (req.secret) {
        if (req.value !== undefined) s.secretValues[key] = req.value
        else if (v.value !== undefined && s.secretValues[key] === undefined) s.secretValues[key] = v.value
        delete v.value
        v.set = !!s.secretValues[key]
      } else {
        // Turning a secret into a plain variable never reveals the old value.
        v.value = req.value ?? v.value ?? ''
        delete v.set
        delete s.secretValues[key]
      }
      persist()
      return json<CiResponse>(ciView(s))
    })
  }),

  http.delete(api('/projects/:id/ci/variables/:key'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => {
      const s = ci(pid)
      s.variables = s.variables.filter((x) => x.key !== params.key)
      delete s.secretValues[String(params.key)]
      persist()
      return json<CiResponse>(ciView(s))
    })
  }),

  // ── Agent.md ──────────────────────────────────────────────────────────────────────
  http.get(api('/projects/:id/agent'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => json<AgentDoc>(agent(pid)))
  }),

  http.put(api('/projects/:id/agent'), async ({ params, request }) => {
    await latency(200)
    const req = await body<{ content: string }>(request)
    return withProject(params.id, (_p, pid) => {
      if (typeof req.content !== 'string') return fail(400, 'validation', 'Content is required')
      if (req.content.length > 40_000)
        return fail(413, 'too_large', 'Agent.md is limited to 40,000 characters')
      const doc: AgentDoc = { content: req.content, updatedAt: new Date().toISOString(), updatedBy: ME.name }
      db.state[pid]!.ext['settings.agent'] = doc
      persist()
      return json<AgentDoc>(doc)
    })
  }),

  // ── Translations ──────────────────────────────────────────────────────────────────
  http.post(api('/projects/:id/translations/ai-translate'), async ({ params, request }) => {
    await latency(900)
    const req = await body<AiTranslateRequest>(request)
    return withProject(params.id, () => {
      if (!req.language) return fail(400, 'validation', 'Pick a language')
      const translations = Object.fromEntries(
        Object.entries(req.items ?? {}).map(([k, text]) => [k, fakeTranslate(req.language, text)]),
      )
      return HttpResponse.json<AiTranslateResponse>({ language: req.language, translations })
    })
  }),
]
