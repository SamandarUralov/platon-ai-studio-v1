/**
 * Mock handlers — logic: test runs (functions, APIs, crons), API runs and history, queue messages,
 * runtime stats (requirements §6.1). Test runs use a deterministic simulation of the layer tree,
 * so the trace is stable for the same inputs and run number.
 */
import { http, type HttpHandler } from 'msw'
import {
  newId,
  type Api,
  type AppDefinition,
  type Cron,
  type LogicFunction,
  type LogicHistoryEntry,
  type LogicRun,
  type LogicStatsResponse,
  type LogicTestRequest,
  type LogicTestResponse,
  type QueueMessage,
  type SendQueueMessageRequest,
  type Step,
  type TraceStep,
  type TypedField,
} from '@platon/definition'
import { splitArgs, validateLogic } from '@platon/validators'
import { ext, persist, type ProjectState } from '../db'
import { action, api, body, fail, json, latency, withProject } from '../http'
import { hash, prng, seedLogicRuntime, type LogicRuntime } from '../seed/logic'

// ── simulation ───────────────────────────────────────────────────────────────────────

type Vars = Record<string, unknown>

const ROWS: Record<string, (input: Vars, k: number) => Record<string, unknown>> = {
  work_orders: (inp, k) => ({
    id: str(inp.order_id) || `WO-104${2 + k}`,
    status: str(inp.status) || 'scheduled',
    priority: 'high',
    trade: str(inp.trade) || 'HVAC',
    site_id: 'site_04',
    customer_id: 'cus_118',
    created_at: '2026-10-08T09:00:00-07:00',
    labor_cost: 180,
  }),
  technicians: (_i, k) => ({
    id: `tech_0${7 + k}`,
    name: ['Sam Ortiz', 'Lena Park'][k % 2],
    region: 'North',
    phone: '+1 415 555 0142',
    skills: ['HVAC', 'Electrical'],
  }),
  sites: () => ({
    id: 'site_04',
    name: 'Northwind Clinic · Mission St',
    timezone: 'America/Los_Angeles',
    lat: 37.7749,
    lng: -122.4194,
  }),
  customers: () => ({ id: 'cus_118', name: 'Northwind Clinics', phone: '+1 415 555 0142' }),
  parts_used: (_i, k) => ({
    id: `pu_${k + 1}`,
    part: ['Compressor relay', 'Air filter'][k % 2],
    qty: k + 1,
    price: [42.5, 18][k % 2],
  }),
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function mockRow(table: string, input: Vars, k = 0): Record<string, unknown> {
  return ROWS[table]?.(input, k) ?? { id: `${table || 'row'}_${k + 1}` }
}

const PATH = /^([A-Za-z_$][\w$]*)((?:\.[\w$]+)*)$/
const CMP = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/

function resolvePath(expr: string, vars: Vars, input: Vars): unknown {
  const m = PATH.exec(expr)
  if (!m) return undefined
  let v: unknown = m[1] === 'input' ? input : vars[m[1]!]
  for (const k of (m[2] ?? '').split('.').filter(Boolean)) {
    if (v == null) return undefined
    if (Array.isArray(v)) v = k === 'length' ? v.length : (v[0] as Vars | undefined)?.[k]
    else if (typeof v === 'object') v = (v as Vars)[k]
    else if (typeof v === 'string' && k === 'length') v = v.length
    else return undefined
  }
  return v
}

/** Best-effort evaluation of the small expressions people write in layers. */
export function simEval(expr: string | undefined, vars: Vars, input: Vars, hint = ''): unknown {
  const e = String(expr ?? '').trim()
  if (!e) return null
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e)
  if (/^(['"]).*\1$/.test(e)) return e.slice(1, -1)
  if (e === 'true' || e === 'false') return e === 'true'
  if (e === 'null') return null
  const p = resolvePath(e, vars, input)
  if (p !== undefined) return p
  if (/^\{[\s\S]*\}$/.test(e)) {
    const o: Vars = {}
    for (const part of splitArgs(e.slice(1, -1))) {
      const i = part.indexOf(':')
      const key = (i < 0 ? part : part.slice(0, i)).trim().replace(/^["']|["']$/g, '')
      if (!key) continue
      const val = i < 0 ? key : part.slice(i + 1)
      const r = simEval(val, vars, input, '')
      o[key] = r === undefined ? 'text' : r
    }
    return o
  }
  // Helpers like nearest(list, …) / first(list) / last(list) pick one element of a list.
  const call = /^(\w+)\(([\s\S]*)\)$/.exec(e)
  if (call) {
    const first = resolvePath(splitArgs(call[2])[0] ?? '', vars, input)
    if (Array.isArray(first) && first.length) return call[1] === 'last' ? first[first.length - 1] : first[0]
  }
  const t = hint.toLowerCase()
  if (
    /date|time/.test(t) ||
    (/(date|time|due|_at\b|hours)|addbusiness/i.test(e) && !/^(number|string|boolean|object)$/.test(t))
  )
    return '2026-10-08T13:00:00-07:00'
  if (/number|int/.test(t)) return 42
  if (/bool/.test(t)) return true
  if (/string|text/.test(t)) return 'ok'
  return { ok: true }
}

/** Evaluates `a op b`; anything it can't read counts as true so the main path still runs. */
export function simCondition(expr: string | undefined, vars: Vars, input: Vars): boolean {
  const m = CMP.exec(String(expr ?? '').trim())
  if (!m) {
    const v = simEval(expr, vars, input, 'boolean')
    return !!v
  }
  const read = (x: string) => {
    const t = x.trim()
    if (/^-?\d+(\.\d+)?$/.test(t) || /^(['"]).*\1$/.test(t) || /^(true|false|null)$/.test(t))
      return simEval(t, vars, input)
    return resolvePath(t, vars, input)
  }
  const a = read(m[1]!)
  const b = read(m[3]!)
  if (a === undefined || b === undefined) return true
  switch (m[2]) {
    case '==':
      // Loose on purpose: "200" == 200 in the expression language.
      return a == b
    case '!=':
      return a != b
    case '>':
      return Number(a) > Number(b)
    case '<':
      return Number(a) < Number(b)
    case '>=':
      return Number(a) >= Number(b)
    default:
      return Number(a) <= Number(b)
  }
}

export interface SimOptions {
  /** Run number: changes timings, never results. */
  n: number
  functions: LogicFunction[]
  /** Validator errors by step id; the run stops there like a runtime type error would. */
  stepErrors?: Record<string, string>
  /** Declared return type, used to guess values the simulation can't compute. */
  returns?: string
  params?: TypedField[]
  depth?: number
}

export interface SimResult {
  ok: boolean
  trace: TraceStep[]
  ms: number
  output: unknown
  returned: boolean
  error?: { code: string; message: string; stepId?: string }
  ran: number
  total: number
  failIndex?: number
  vars: Vars
}

const J = (v: unknown) => {
  const s = JSON.stringify(v, null, 2) ?? 'null'
  return s.length > 1200 ? `${s.slice(0, 1200)}…` : s
}

export function simulate(steps: Step[], input: Vars, opts: SimOptions): SimResult {
  const rnd = prng((opts.n * 7919 + 104729) % 233280)
  const trace = new Map<string, TraceStep>()
  const vars: Vars = {}
  const depth = opts.depth ?? 0
  let failed: SimResult['error'] | undefined
  let failIndex: number | undefined
  let returned = false
  let output: unknown = undefined
  let ran = 0
  let total = 0
  let ms = 0
  let lastInto: string | undefined

  const required = new Set((opts.params ?? []).filter((p) => p.req).map((p) => p.name))
  const empty = Object.keys(input).filter((k) => input[k] === '' || input[k] == null)
  const missing = (s: Step) => {
    const text = JSON.stringify(s.config)
    return empty.find((k) => (required.size === 0 || required.has(k)) && text.includes(`input.${k}`))
  }

  const skip = (list: Step[]) => {
    for (const s of list) {
      total++
      trace.set(s.id, { stepId: s.id, type: s.type, status: 'skip', ms: 0 })
      for (const b of s.branches ?? []) skip(b.steps)
    }
  }

  const callFn = (
    name: string | undefined,
    args: string | undefined,
  ): { ok: boolean; value: unknown; msg?: string; t: number } => {
    const fn = opts.functions.find((f) => f.name === name)
    if (!fn) return { ok: false, value: null, msg: `Function “${name ?? ''}” does not exist`, t: 0 }
    if (depth > 3) return { ok: true, value: { ok: true }, t: rnd(20, 60) }
    const argv = splitArgs(args)
    const inner: Vars = {}
    fn.params.forEach((p, i) => {
      const v = argv[i] !== undefined ? simEval(argv[i], vars, input, p.type) : ''
      inner[p.name] = v === undefined ? '' : v
    })
    const r = simulate(fn.steps, inner, {
      ...opts,
      n: opts.n + depth + 1,
      depth: depth + 1,
      returns: fn.returns.type,
      params: fn.params,
      stepErrors: {},
    })
    return { ok: r.ok, value: r.ok ? r.output : r.error, msg: r.error?.message, t: r.ms }
  }

  const run = (list: Step[], mult: number) => {
    for (let i = 0; i < list.length; i++) {
      const s = list[i]!
      if (failed || returned) {
        skip(list.slice(i))
        return
      }
      total++
      ran++
      const c = s.config
      let t = 0
      let out: unknown
      let text: string | undefined
      let status: TraceStep['status'] = 'ok'
      let into = c.into ?? ''
      let pick = -1
      const err = opts.stepErrors?.[s.id]
      const miss = missing(s)
      if (err) {
        status = 'fail'
        t = rnd(0, 2)
        out = { error: 'type_error', message: err }
      } else if (miss) {
        status = 'fail'
        t = rnd(0, 2)
        out = { error: 'missing_input', message: `input.${miss} is empty` }
      } else
        switch (s.type) {
          case 'select': {
            t = rnd(6, 28) * mult
            const table = c.table ?? ''
            out =
              String(c.limit).trim() === '1'
                ? mockRow(table, input)
                : [mockRow(table, input), mockRow(table, input, 1)]
            break
          }
          case 'execute':
            t = rnd(5, 18) * mult
            out = { rowsAffected: 1 }
            vars.last_insert_id = 'WO-1047'
            break
          case 'http':
            t = rnd(120, 380) * mult
            out = {
              status: 200,
              body: {
                ok: true,
                url: `https://files.example.com/${rnd(1000, 9999)}.pdf`,
                items: [{ part_no: 'CMP-2231', stock: 14 }],
              },
            }
            break
          case 'produce':
            t = rnd(3, 9) * mult
            out = { queue: c.queue, messageId: `m_${rnd(4096, 65535).toString(16)}` }
            break
          case 'consume':
            t = rnd(3, 9) * mult
            out = {
              messageId: 'm_a7f1',
              type: 'work_order.created',
              order_id: str(input.order_id) || 'WO-1042',
              trade: 'HVAC',
            }
            break
          case 'call': {
            const r = callFn(c.fn, c.args)
            t = (r.t + rnd(2, 8)) * mult
            if (!r.ok) {
              status = 'fail'
              out = { error: 'call_failed', message: r.msg ?? 'Function failed' }
            } else out = r.value
            break
          }
          case 'set':
            t = rnd(0, 1)
            into = c.name ?? ''
            out = simEval(c.value, vars, input, into === 'result' ? (opts.returns ?? '') : '')
            break
          case 'return': {
            t = rnd(0, 1)
            if (c.from === 'fn') {
              const r = callFn(c.fn, c.args)
              t += r.t
              if (!r.ok) {
                status = 'fail'
                out = { error: 'call_failed', message: r.msg ?? 'Function failed' }
                break
              }
              out = r.value
            } else {
              const name = c.value || lastInto || 'result'
              out = name in vars ? vars[name] : simEval(name, vars, input, opts.returns ?? '')
            }
            output = out
            returned = true
            break
          }
          case 'if': {
            t = rnd(0, 1)
            const yes = simCondition(c.condition, vars, input)
            pick = yes ? 0 : 1
            text = `condition → ${yes} · ran ${s.branches?.[pick]?.label ?? (yes ? 'Then' : 'Else')}`
            break
          }
          case 'switch': {
            t = rnd(0, 1)
            const val = simEval(c.value, vars, input, 'string')
            const br = s.branches ?? []
            const i2 = br.findIndex((b) => b.label.replace(/^Case\s+/, '').trim() === String(val))
            pick = i2 >= 0 ? i2 : br.length - 1
            text = `value → ${JSON.stringify(val)} · ran ${br[pick]?.label ?? 'Default'}`
            break
          }
          case 'for': {
            const list2 = resolvePath(c.list ?? '', vars, input)
            const items = Array.isArray(list2) ? list2 : [1, 2, 3]
            vars[c.as || 'item'] = items[0]
            text = `${items.length} iterations`
            break
          }
        }
      if (into && out !== undefined && status === 'ok') {
        vars[into] = out
        lastInto = into
      }
      ms += t
      const entry: TraceStep = {
        stepId: s.id,
        type: s.type,
        status,
        ms: t,
        output: text ?? J(out),
        ...(into && status === 'ok' ? { into } : {}),
      }
      trace.set(s.id, entry)
      if (status === 'fail') {
        const o = out as { error: string; message: string }
        failed = { code: o.error, message: o.message, stepId: s.id }
        failIndex = ran
        continue
      }
      if (s.branches) {
        if (s.type === 'for') {
          const before = ms
          const n = Array.isArray(resolvePath(c.list ?? '', vars, input))
            ? Math.max(1, (resolvePath(c.list ?? '', vars, input) as unknown[]).length)
            : 3
          run(s.branches[0]?.steps ?? [], n)
          entry.ms = ms - before + t
          entry.output = `${n} iterations · ${ms - before} ms in body`
        } else {
          s.branches.forEach((b, j) => (j === pick ? run(b.steps, mult) : skip(b.steps)))
        }
      }
    }
  }

  run(steps, 1)
  // Without a Return layer the function hands back the last saved result.
  if (!failed && !returned && lastInto) output = vars[lastInto]
  return {
    ok: !failed,
    trace: [...trace.values()],
    ms,
    output: failed ? failed : (output ?? null),
    returned,
    error: failed,
    ran,
    total,
    failIndex,
    vars,
  }
}

// ── runtime state ────────────────────────────────────────────────────────────────────

type Kind = 'functions' | 'apis' | 'crons' | 'queues'

function rt(p: ProjectState, pid: string): LogicRuntime {
  return ext(pid, 'logic', () => seedLogicRuntime(p.definition))
}

/** Problems on the given item's layers, keyed by step id (errors only). */
function stepErrorsFor(def: AppDefinition, kind: Kind, id: string): Record<string, string> {
  const prefix = `/logic/${kind}/${id}/steps/`
  const out: Record<string, string> = {}
  for (const pr of validateLogic(def))
    if (pr.severity === 'error' && pr.path.startsWith(prefix)) {
      const sid = pr.path.slice(prefix.length).split('/')[0]!
      out[sid] ??= pr.message
    }
  return out
}

/** The definition with the client's unsaved draft swapped in, so tests and checks see it. */
function withDraft<T extends LogicFunction | Api | Cron>(
  def: AppDefinition,
  kind: 'functions' | 'apis' | 'crons',
  item: T | undefined,
): AppDefinition {
  if (!item) return def
  const list = def.logic[kind] as T[]
  const next = list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
  return { ...def, logic: { ...def.logic, [kind]: next } }
}

const CODES: Record<Api['protocol'], { ok: string; bad: string; err: string }> = {
  rest: { ok: '200', bad: '400', err: '500' },
  soap: { ok: 'Response', bad: 'Fault', err: 'Fault' },
  grpc: { ok: 'OK', bad: 'INVALID_ARGUMENT', err: 'INTERNAL' },
  jsonrpc: { ok: 'result', bad: '-32602', err: '-32603' },
}

function nextN(r: LogicRuntime, key: string): number {
  r.counters[key] = (r.counters[key] ?? 0) + 1
  return r.counters[key]
}

function testFunction(p: ProjectState, pid: string, id: string, req: LogicTestRequest): Response {
  const def = withDraft(p.definition, 'functions', req.item as LogicFunction | undefined)
  const fn = def.logic.functions.find((f) => f.id === id)
  if (!fn) return fail(404, 'not_found', `Function ${id} not found`)
  const r = rt(p, pid)
  const n = nextN(r, `functions/${id}`)
  const sim = simulate(fn.steps, req.input ?? {}, {
    n,
    functions: def.logic.functions,
    stepErrors: stepErrorsFor(def, 'functions', id),
    returns: fn.returns.type,
    params: fn.params,
  })
  const s = r.stats.functions[id]
  if (s) {
    s.lastRunAt = new Date().toISOString()
    s.runs24h++
  }
  persist()
  return json<LogicTestResponse>({
    runId: newId('run'),
    n,
    ok: sim.ok,
    status: sim.ok ? 'ok' : 'error',
    ms: sim.ms,
    at: new Date().toISOString(),
    output: sim.output,
    ...(sim.error ? { error: sim.error } : {}),
    trace: sim.trace,
    ran: sim.ran,
    total: sim.total,
    ...(sim.failIndex ? { failIndex: sim.failIndex } : {}),
  })
}

function testApi(p: ProjectState, pid: string, id: string, req: LogicTestRequest): Response {
  const def = withDraft(p.definition, 'apis', req.item as Api | undefined)
  const a = def.logic.apis.find((x) => x.id === id)
  if (!a) return fail(404, 'not_found', `API ${id} not found`)
  const r = rt(p, pid)
  const n = nextN(r, `apis/${id}`)
  const fields = [...a.request.path, ...a.request.query, ...a.request.headers, ...a.request.body]
  const input = req.input ?? {}
  const codes = CODES[a.protocol]
  const missing = fields.filter((f) => f.req && !String(input[f.name] ?? '').trim()).map((f) => f.name)
  let status: string
  let output: unknown
  let sim: SimResult | null = null
  if (missing.length) {
    status = codes.bad
    output =
      a.protocol === 'soap'
        ? { faultcode: 'soap:Client', faultstring: `Missing ${missing.join(', ')}` }
        : { error: 'validation_failed', missing }
  } else {
    sim = simulate(a.steps, input, {
      n,
      functions: def.logic.functions,
      stepErrors: stepErrorsFor(def, 'apis', id),
      params: fields,
    })
    status = sim.ok ? codes.ok : codes.err
    output = sim.ok
      ? (sim.output ?? { ok: true })
      : a.protocol === 'soap'
        ? { faultcode: 'soap:Server', faultstring: sim.error?.message }
        : { error: sim.error?.code, step: sim.error?.stepId, message: sim.error?.message }
  }
  const ms = (sim?.ms ?? 0) + prng(n)(4, 12)
  const ok = status === codes.ok
  const run: LogicRun = { id: newId('run'), at: new Date().toISOString(), env: 'development', status, ok, ms }
  r.runs[id] = [run, ...(r.runs[id] ?? [])].slice(0, 50)
  persist()
  return json<LogicTestResponse>({
    runId: run.id,
    n,
    ok,
    status,
    ms,
    at: run.at,
    output,
    ...(sim?.error ? { error: sim.error } : {}),
    trace: sim?.trace ?? [],
    ran: sim?.ran ?? 0,
    total: sim?.total ?? 0,
    ...(sim?.failIndex ? { failIndex: sim.failIndex } : {}),
  })
}

function runCron(p: ProjectState, pid: string, id: string, req: LogicTestRequest): Response {
  const def = withDraft(p.definition, 'crons', req.item as Cron | undefined)
  const c = def.logic.crons.find((x) => x.id === id)
  if (!c) return fail(404, 'not_found', `Cron ${id} not found`)
  const r = rt(p, pid)
  const n = nextN(r, `crons/${id}`)
  const sim = simulate(
    c.steps,
    {},
    { n, functions: def.logic.functions, stepErrors: stepErrorsFor(def, 'crons', id) },
  )
  r.stats.crons[id] = { lastRunAt: new Date().toISOString(), lastMs: sim.ms, lastOk: sim.ok }
  persist()
  return json<LogicTestResponse>({
    runId: newId('run'),
    n,
    ok: sim.ok,
    status: sim.ok ? 'ok' : 'error',
    ms: sim.ms,
    at: new Date().toISOString(),
    output: sim.output,
    ...(sim.error ? { error: sim.error } : {}),
    trace: sim.trace,
    ran: sim.ran,
    total: sim.total,
  })
}

/** Unreleased definition changes touching the item, newest first, then the seeded audit trail. */
function historyFor(p: ProjectState, r: LogicRuntime, kind: Kind, id: string): LogicHistoryEntry[] {
  const prefix = `/logic/${kind}/${id}`
  const pending = p.changes
    .filter((c) => c.ops.some((o) => o.path === prefix || o.path.startsWith(`${prefix}/`)))
    .map<LogicHistoryEntry>((c) => ({
      id: c.id,
      at: c.createdAt,
      who: c.author,
      text: c.text,
      released: !!c.releaseId,
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
  return [
    ...pending.filter((x) => !x.released),
    ...pending.filter((x) => x.released),
    ...(r.history[id] ?? []),
  ]
}

function refreshQueueStats(r: LogicRuntime, qid: string) {
  const m = r.messages[qid] ?? []
  const s = (r.stats.queues[qid] ??= { waiting: 0, processed24h: 0, dead: 0 })
  s.waiting = m.filter((x) => x.status === 'waiting' || x.status === 'retrying').length
  s.dead = m.filter((x) => x.status === 'dead').length
}

/** Fill in stats for items created after the seed, so every item has a row. */
function statsFor(p: ProjectState, r: LogicRuntime): LogicStatsResponse {
  const { functions, apis, crons, queues } = p.definition.logic
  const s = r.stats
  for (const f of functions) s.functions[f.id] ??= { lastRunAt: null, avgMs: 0, runs24h: 0, errors24h: 0 }
  for (const a of apis) s.apis[a.id] ??= { requests24h: 0, p95Ms: 0, failed24h: 0 }
  for (const c of crons) s.crons[c.id] ??= { lastRunAt: null, lastMs: 0, lastOk: true }
  for (const q of queues) {
    r.messages[q.id] ??= []
    refreshQueueStats(r, q.id)
  }
  return s
}

const base = '/projects/:projectId/logic'

export const logicHandlers: HttpHandler[] = [
  http.get(api(`${base}/stats`), async ({ params }) => {
    await latency(120)
    return withProject(params.projectId, (p, pid) => json<LogicStatsResponse>(statsFor(p, rt(p, pid))))
  }),

  // POST …/functions/{fid}:test · …/apis/{aid}:test · …/crons/{cid}:run
  http.post(api(`${base}/:kind/:item`), async ({ params, request }) => {
    const [id, verb] = action(params.item)
    const kind = String(params.kind)
    const req = await body<LogicTestRequest>(request)
    await latency(kind === 'apis' ? 380 : 520)
    return withProject(params.projectId, (p, pid) => {
      if (kind === 'functions' && verb === 'test') return testFunction(p, pid, id, req)
      if (kind === 'apis' && verb === 'test') return testApi(p, pid, id, req)
      if (kind === 'crons' && (verb === 'run' || verb === 'test')) return runCron(p, pid, id, req)
      if (kind === 'queues' && verb === 'send') {
        const r = rt(p, pid)
        const q = p.definition.logic.queues.find((x) => x.id === id)
        if (!q) return fail(404, 'not_found', `Queue ${id} not found`)
        const sendBody = (req as unknown as SendQueueMessageRequest).body
        const rnd = prng(hash(id) + r.seq++)
        const sample: Record<string, unknown> = {}
        for (const f of q.fields)
          sample[f.name] =
            f.type === 'datetime'
              ? new Date().toISOString()
              : f.type === 'boolean'
                ? false
                : f.name.endsWith('id')
                  ? `WO-10${rnd(48, 99)}`
                  : 'test'
        const msg: QueueMessage = {
          id: `m_${rnd(4096, 65535).toString(16)}`,
          at: new Date().toISOString(),
          status: 'waiting',
          attempts: 0,
          body: sendBody ?? sample,
        }
        r.messages[id] = [msg, ...(r.messages[id] ?? [])]
        refreshQueueStats(r, id)
        persist()
        return json(msg, { status: 201 })
      }
      if (kind === 'queues' && verb === 'replayDead') {
        const r = rt(p, pid)
        let n = 0
        r.messages[id] = (r.messages[id] ?? []).map((m) =>
          m.status === 'dead'
            ? (n++, { ...m, status: 'waiting' as const, attempts: 0, at: new Date().toISOString() })
            : m,
        )
        refreshQueueStats(r, id)
        persist()
        return json({ replayed: n })
      }
      return fail(404, 'not_found', `Unknown action ${kind}/${String(params.item)}`)
    })
  }),

  http.get(api(`${base}/:kind/:id/runs`), async ({ params }) => {
    await latency(140)
    return withProject(params.projectId, (p, pid) =>
      json({ items: rt(p, pid).runs[String(params.id)] ?? [] }),
    )
  }),

  http.get(api(`${base}/:kind/:id/history`), async ({ params }) => {
    await latency(140)
    return withProject(params.projectId, (p, pid) =>
      json({ items: historyFor(p, rt(p, pid), String(params.kind) as Kind, String(params.id)) }),
    )
  }),

  http.get(api(`${base}/queues/:id/messages`), async ({ params }) => {
    await latency(140)
    return withProject(params.projectId, (p, pid) =>
      json({ items: rt(p, pid).messages[String(params.id)] ?? [] }),
    )
  }),

  // POST …/queues/{qid}/messages/{mid}:replay
  http.post(api(`${base}/queues/:id/messages/:msg`), async ({ params }) => {
    await latency(160)
    const [mid, verb] = action(params.msg)
    return withProject(params.projectId, (p, pid) => {
      if (verb !== 'replay') return fail(404, 'not_found', 'Unknown action')
      const r = rt(p, pid)
      const qid = String(params.id)
      const list = r.messages[qid] ?? []
      const m = list.find((x) => x.id === mid)
      if (!m) return fail(404, 'not_found', `Message ${mid} not found`)
      r.messages[qid] = list.map((x) =>
        x.id === mid
          ? { ...x, status: 'waiting', attempts: 0, at: new Date().toISOString(), error: undefined }
          : x,
      )
      refreshQueueStats(r, qid)
      persist()
      return json(r.messages[qid]!.find((x) => x.id === mid))
    })
  }),

  http.delete(api(`${base}/queues/:id/messages/:msg`), async ({ params }) => {
    await latency(120)
    return withProject(params.projectId, (p, pid) => {
      const r = rt(p, pid)
      const qid = String(params.id)
      r.messages[qid] = (r.messages[qid] ?? []).filter((x) => x.id !== String(params.msg))
      refreshQueueStats(r, qid)
      persist()
      return new Response(null, { status: 204 })
    })
  }),
]
