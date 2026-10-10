/** Projects, session, definition, changes, validation, members (requirements §6.1). */
import { http, HttpResponse } from 'msw'
import {
  applyPatch,
  makeChange,
  PatchError,
  upsertChange,
  type ApplyChangesRequest,
  type ApplyChangesResponse,
  type CreateProjectRequest,
  type DefinitionResponse,
  type ProjectSummary,
  type SessionResponse,
  type ValidateResponse,
  getAt,
  snake,
} from '@platon/definition'
import { validateAll } from '@platon/validators'
import { db, freshState, persist } from '../db'
import { DIRECTORY, ME, ORG } from '../seed'
import { api, body, fail, json, latency, withProject } from '../http'

const TINTS: [string, string][] = [
  ['#4f5bea', '#eef0ff'],
  ['#0e7c66', '#e3f5ef'],
  ['#d9541e', '#fff1ea'],
  ['#0a7bbf', '#e6f3fa'],
  ['#8a3fb8', '#f3ecff'],
  ['#2a2c3f', '#f2f2f6'],
]

export const coreHandlers = [
  http.get(api('/session'), async () => {
    await latency(80)
    return json<SessionResponse>({ user: ME, organization: ORG, isPlatformAdmin: true })
  }),

  http.get(api('/directory'), async ({ request }) => {
    await latency(60)
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    const items = DIRECTORY.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(api('/projects'), async () => {
    await latency()
    return HttpResponse.json({
      items: [...db.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    })
  }),

  http.post(api('/projects'), async ({ request }) => {
    await latency(400)
    const req = await body<CreateProjectRequest>(request)
    if (!req.name?.trim())
      return fail(400, 'validation', 'Give the app a name', [{ path: 'name', problem: 'required' }])
    const source = req.copyFrom ? db.projects.find((p) => p.id === req.copyFrom) : undefined
    let id = snake(req.name) || 'app'
    let n = 2
    while (db.state[id]) id = `${snake(req.name)}_${n++}`
    const [accent, tint] =
      TINTS.find(([a]) => a === req.theme?.color) ?? TINTS[db.projects.length % TINTS.length]!
    const summary: ProjectSummary = {
      id,
      name: req.name.trim(),
      slug: id.replace(/_/g, '-'),
      description: req.purpose || source?.description || 'New app',
      status: 'development',
      accent: req.theme?.color ?? accent,
      tint,
      updatedAt: new Date().toISOString(),
      updatedBy: ME.name,
      version: 1,
      ...(source ? { copiedFrom: source.name } : {}),
    }
    db.projects.push(summary)
    const state = source ? structuredClone(db.state[source.id]!) : freshState(summary)
    state.definition = { ...state.definition, id, name: summary.name, version: 1 }
    if (req.languages?.length)
      state.definition.settings = {
        ...state.definition.settings,
        languages: req.languages,
        defaultLanguage: req.languages[0]!,
      }
    if (req.theme) state.definition.settings = { ...state.definition.settings, theme: req.theme }
    if (req.signIn?.length)
      state.definition.settings = { ...state.definition.settings, signIn: req.signIn as never }
    if (req.modules?.length)
      state.definition.settings = { ...state.definition.settings, modules: req.modules }
    if (!req.data?.sample) state.records = Object.fromEntries(Object.keys(state.records).map((k) => [k, []]))
    state.changes = []
    state.releases = []
    db.state[id] = state
    persist()
    return HttpResponse.json(summary, { status: 201 })
  }),

  http.get(api('/projects/:id'), async ({ params }) => {
    await latency(80)
    const p = db.projects.find((x) => x.id === params.id)
    return p ? HttpResponse.json(p) : fail(404, 'not_found', 'Project not found')
  }),

  http.patch(api('/projects/:id'), async ({ params, request }) => {
    await latency()
    const p = db.projects.find((x) => x.id === params.id)
    if (!p) return fail(404, 'not_found', 'Project not found')
    Object.assign(p, await body<Partial<ProjectSummary>>(request), { updatedAt: new Date().toISOString() })
    persist()
    return HttpResponse.json(p)
  }),

  http.delete(api('/projects/:id'), async ({ params }) => {
    await latency()
    db.projects = db.projects.filter((x) => x.id !== params.id)
    delete db.state[String(params.id)]
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/projects/:id/definition'), async ({ params, request }) => {
    await latency(120)
    return withProject(params.id, (p) => {
      const paths = new URL(request.url).searchParams.get('paths')
      if (paths) {
        const partial = Object.fromEntries(
          paths.split(',').map((x) => [x, getAt(p.definition, '/' + x.replace(/\./g, '/'))]),
        )
        return HttpResponse.json({ version: p.definition.version, definition: partial })
      }
      return json<DefinitionResponse>({ version: p.definition.version, definition: p.definition })
    })
  }),

  http.post(api('/projects/:id/changes'), async ({ params, request }) => {
    await latency(90)
    const req = await body<ApplyChangesRequest>(request)
    return withProject(params.id, (p, pid) => {
      if (req.baseVersion !== p.definition.version)
        return HttpResponse.json(
          {
            error: 'conflict',
            message: 'Someone else changed the app. Rebase and retry.',
            version: p.definition.version,
            ops: [],
          },
          { status: 409 },
        )
      let def = p.definition
      const created = []
      try {
        for (const c of req.changes) {
          def = applyPatch(def, c.ops)
          created.push(
            makeChange(
              c,
              req.authorKind === 'ai' ? 'Studio AI' : ME.name,
              req.baseVersion,
              req.authorKind ?? 'human',
            ),
          )
        }
      } catch (e) {
        if (e instanceof PatchError)
          return fail(422, 'invalid_patch', e.message, [{ path: e.op.path, problem: e.message }])
        throw e
      }
      def = { ...def, version: def.version + 1 }
      p.definition = def
      for (const c of created) p.changes = upsertChange(p.changes, c)
      const summary = db.projects.find((x) => x.id === pid)
      if (summary)
        Object.assign(summary, {
          updatedAt: new Date().toISOString(),
          updatedBy: ME.name,
          version: def.version,
        })
      persist()
      return json<ApplyChangesResponse>({ version: def.version, changes: created })
    })
  }),

  http.get(api('/projects/:id/changes'), async ({ params }) => {
    await latency(90)
    return withProject(params.id, (p) => HttpResponse.json({ items: p.changes.filter((c) => !c.releaseId) }))
  }),

  http.post(api('/projects/:id/validate'), async ({ params }) => {
    await latency(120)
    return withProject(params.id, (p) =>
      json<ValidateResponse>({ problems: validateAll(p.definition), checkedAt: new Date().toISOString() }),
    )
  }),

  http.get(api('/projects/:id/members'), async ({ params }) => {
    await latency()
    return withProject(params.id, (p) => HttpResponse.json({ items: p.members }))
  }),

  http.post(api('/projects/:id/members'), async ({ params, request }) => {
    await latency()
    const req = await body<{ email: string; role: 'admin' | 'editor' | 'viewer' }>(request)
    return withProject(params.id, (p) => {
      if (!/^[^@\s]+@[^@\s]+$/.test(req.email ?? ''))
        return fail(400, 'validation', 'Enter a valid email address')
      if (p.members.some((m) => m.email === req.email))
        return fail(409, 'exists', 'This person is already a member')
      const name = req.email
        .split('@')[0]!
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      const m = {
        id: `u_${Date.now().toString(36)}`,
        name,
        email: req.email,
        role: req.role ?? 'editor',
        invitedAt: new Date().toISOString(),
      }
      p.members.push(m)
      persist()
      return HttpResponse.json(m, { status: 201 })
    })
  }),

  http.patch(api('/projects/:id/members/:uid'), async ({ params, request }) => {
    await latency()
    const req = await body<{ role: 'owner' | 'admin' | 'editor' | 'viewer' }>(request)
    return withProject(params.id, (p) => {
      const m = p.members.find((x) => x.id === params.uid)
      if (!m) return fail(404, 'not_found', 'Member not found')
      if (
        m.role === 'owner' &&
        p.members.filter((x) => x.role === 'owner').length === 1 &&
        req.role !== 'owner'
      )
        return fail(400, 'last_owner', 'A project needs at least one owner')
      m.role = req.role
      persist()
      return HttpResponse.json(m)
    })
  }),

  http.delete(api('/projects/:id/members/:uid'), async ({ params }) => {
    await latency()
    return withProject(params.id, (p) => {
      const m = p.members.find((x) => x.id === params.uid)
      if (m?.role === 'owner')
        return fail(400, 'last_owner', 'Owners can’t be removed — change their role first')
      p.members = p.members.filter((x) => x.id !== params.uid)
      persist()
      return new HttpResponse(null, { status: 204 })
    })
  }),

  http.get(api('/projects/:id/presence'), async () => {
    await latency(40)
    return HttpResponse.json({
      items: [
        {
          userId: 'u_priya',
          name: 'Priya Nair',
          location: 'Logic · assignNearestTech',
          editing: '/logic/functions/assign_nearest_tech',
        },
        { userId: 'u_jordan', name: 'Jordan Lee', location: 'Interface · Dashboard' },
      ],
    })
  }),
]
