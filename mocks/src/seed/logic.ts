/**
 * Runtime state of the Logic layer for the mock backend: API runs, audit history, queue messages
 * and health stats. Generated per project from its definition, so copied apps get sensible data.
 */
import type {
  AppDefinition,
  LogicHistoryEntry,
  LogicRun,
  LogicStatsResponse,
  QueueMessage,
} from '@platon/definition'

export interface LogicRuntime {
  runs: Record<string, LogicRun[]>
  history: Record<string, LogicHistoryEntry[]>
  messages: Record<string, QueueMessage[]>
  /** Test-run counters per item (`functions/calc_sla_due` → 3). */
  counters: Record<string, number>
  stats: LogicStatsResponse
  seq: number
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

/** Small deterministic PRNG so seeds look varied but stay stable between reloads. */
export function prng(seed: number) {
  let s = seed % 233280
  return (a: number, b: number) => {
    s = (s * 9301 + 49297) % 233280
    return a + Math.round((s / 233280) * (b - a))
  }
}

export function hash(s: string): number {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003
  return h
}

const API_HISTORY: Record<string, [number, string, string][]> = {
  get_work_orders: [
    [9 * DAY, 'Maya Chen', 'Released in v1.4 → Production'],
    [17 * DAY, 'Maya Chen', 'Added cursor parameter'],
    [27 * DAY, 'Studio AI', 'Created API'],
  ],
  post_work_orders: [
    [9 * DAY, 'Maya Chen', 'Released in v1.4 → Production'],
    [14 * DAY, 'Diego Ruiz', 'Added calcSlaDue after assignNearestTech'],
    [25 * DAY, 'Studio AI', 'Created API'],
  ],
  patch_status: [
    [11 * DAY, 'Diego Ruiz', 'Limited access to Technician, Dispatcher'],
    [25 * DAY, 'Maya Chen', 'Created API'],
  ],
  parts_webhook: [
    [7 * DAY, 'Diego Ruiz', 'Removed status argument from updateOrderStatus'],
    [10 * DAY, 'Maya Chen', 'Switched auth to Basic'],
    [19 * DAY, 'Maya Chen', 'Created API'],
  ],
}

/** Items that look unhealthy in the seed, so warning dots and badges have something to show. */
const WARN_FUNCTIONS = new Set(['generate_invoice_pdf'])
const WARN_APIS = new Set(['parts_webhook'])

function apiRuns(id: string, warn: boolean): LogicRun[] {
  const r = prng(hash(id))
  const envs = ['production', 'production', 'staging', 'production', 'development', 'production'] as const
  return envs.map((env, i) => {
    const bad = (warn && i % 3 === 1) || i === 2
    const status = bad ? (i === 2 ? '400' : '500') : '200'
    return {
      id: `run_${id}_${i}`,
      at: ago(i * 7 * MIN + r(0, 4) * MIN),
      env,
      status,
      ok: !bad,
      ms: bad && status === '400' ? r(4, 14) : r(40, warn ? 260 : 120),
    }
  })
}

function messagesFor(queueId: string): QueueMessage[] {
  const r = prng(hash(queueId))
  const id = () => `m_${r(4096, 65535).toString(16)}`
  if (queueId === 'work_order_events')
    return [
      {
        id: id(),
        at: ago(1 * MIN),
        status: 'waiting',
        attempts: 0,
        body: { type: 'work_order.created', order_id: 'WO-1046', at: ago(1 * MIN) },
      },
      {
        id: id(),
        at: ago(3 * MIN),
        status: 'waiting',
        attempts: 0,
        body: { type: 'part.shipped', order_id: 'WO-1039', at: ago(3 * MIN) },
      },
      {
        id: id(),
        at: ago(4 * MIN),
        status: 'retrying',
        attempts: 2,
        body: { type: 'work_order.created', order_id: 'WO-1045', at: ago(4 * MIN) },
        error: 'assignNearestTech timed out after 30 s',
      },
      {
        id: id(),
        at: ago(9 * MIN),
        status: 'delivered',
        attempts: 1,
        body: { type: 'work_order.created', order_id: 'WO-1044', at: ago(9 * MIN) },
      },
      {
        id: id(),
        at: ago(22 * MIN),
        status: 'delivered',
        attempts: 1,
        body: { type: 'work_order.created', order_id: 'WO-1043', at: ago(22 * MIN) },
      },
    ]
  if (queueId === 'sms_outbound')
    return [
      {
        id: id(),
        at: ago(6 * MIN),
        status: 'delivered',
        attempts: 1,
        body: { to: '+1 415 555 0142', text: 'Your technician is 10 min away.' },
      },
      {
        id: id(),
        at: ago(31 * MIN),
        status: 'delivered',
        attempts: 2,
        body: { to: '+1 415 555 0177', text: 'Job WO-1041 is complete.', retry: true },
      },
    ]
  if (queueId === 'invoice_generation')
    return [
      { id: id(), at: ago(12 * MIN), status: 'waiting', attempts: 0, body: { order_id: 'WO-1040' } },
      {
        id: id(),
        at: ago(48 * MIN),
        status: 'dead',
        attempts: 4,
        body: { order_id: 'WO-0988' },
        error: 'PDF renderer returned 502',
      },
      {
        id: id(),
        at: ago(2 * HOUR),
        status: 'dead',
        attempts: 4,
        body: { order_id: 'WO-0991' },
        error: 'Template “invoice” not found',
      },
      { id: id(), at: ago(3 * HOUR), status: 'delivered', attempts: 1, body: { order_id: 'WO-0987' } },
    ]
  return []
}

export function seedLogicRuntime(def: AppDefinition): LogicRuntime {
  const { functions, apis, crons, queues } = def.logic
  const runs: LogicRuntime['runs'] = {}
  const history: LogicRuntime['history'] = {}
  for (const a of apis) {
    runs[a.id] = apiRuns(a.id, WARN_APIS.has(a.id))
    const h = API_HISTORY[a.id] ?? [[8 * DAY, 'Maya Chen', 'Created API']]
    history[a.id] = h.map(([t, who, text], i) => ({
      id: `h_${a.id}_${i}`,
      at: ago(t),
      who,
      text,
      released: true,
    }))
  }
  const messages: LogicRuntime['messages'] = {}
  for (const q of queues) messages[q.id] = messagesFor(q.id)

  const stats: LogicStatsResponse = { functions: {}, apis: {}, crons: {}, queues: {} }
  for (const f of functions) {
    const r = prng(hash(f.id))
    stats.functions[f.id] = {
      lastRunAt: ago(r(1, 90) * MIN),
      avgMs: r(30, 320),
      runs24h: r(20, 2400),
      errors24h: WARN_FUNCTIONS.has(f.id) ? 3 : 0,
    }
  }
  for (const a of apis) {
    const r = prng(hash(a.id) + 1)
    stats.apis[a.id] = {
      requests24h: r(50, 12_000),
      p95Ms: r(40, 220),
      failed24h: WARN_APIS.has(a.id) ? 4 : 0,
    }
  }
  for (const c of crons) {
    const r = prng(hash(c.id) + 2)
    stats.crons[c.id] = {
      lastRunAt: c.enabled ? ago(r(1, 20) * HOUR) : ago(7 * DAY),
      lastMs: r(400, 4800),
      lastOk: true,
    }
  }
  for (const q of queues) {
    const m = messages[q.id] ?? []
    stats.queues[q.id] = {
      waiting: m.filter((x) => x.status === 'waiting').length,
      processed24h: prng(hash(q.id))(60, 2200),
      dead: m.filter((x) => x.status === 'dead').length,
    }
  }
  return { runs, history, messages, counters: {}, stats, seq: 1 }
}
