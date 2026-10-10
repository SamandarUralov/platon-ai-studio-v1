/** Naming, defaults and templates for Logic items. */
import {
  makeStep,
  uniqueName,
  VALUE_TYPES,
  type Api,
  type AppDefinition,
  type Cron,
  type LogicFunction,
  type LogicKind,
  type Queue,
  type Step,
} from '@platon/definition'
import { apiLabel } from './apis'
import type { LogicItem } from './nav'

export const KIND_NOUN: Record<LogicKind, string> = {
  functions: 'function',
  apis: 'API',
  crons: 'cron',
  queues: 'queue',
}

export function itemTitle(kind: LogicKind, it: LogicItem): string {
  if (kind === 'apis') {
    const a = it as Api
    if (a.name) return a.name
    const l = apiLabel(a)
    return `${l.badge} ${l.text}`
  }
  return (it as LogicFunction | Cron | Queue).name
}

/** "assignNearestTech" → "assign_nearest_tech", "Nightly SLA" → "nightly_sla". */
export function toSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'n$1')
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken)
  const b = toSnake(base) || 'item'
  let id = b
  for (let i = 2; set.has(id); i++) id = `${b}_${i}`
  return id
}

export function stepsOf(it: LogicItem | undefined): Step[] {
  return it && 'steps' in it ? it.steps : []
}

/** Return types offered for signatures: value types plus rows of each table. */
export function fnTypes(def: AppDefinition | null): string[] {
  const tables = def?.data.tables.map((t) => t.id) ?? []
  return [...VALUE_TYPES, 'void', ...tables.map((t) => `row<${t}>`), ...tables.map((t) => `array<${t}>`)]
}

export function newItem(kind: LogicKind, def: AppDefinition, pkg?: string): LogicItem {
  const L = def.logic
  const p = pkg ? { package: pkg } : {}
  if (kind === 'functions') {
    const name = uniqueName(
      'newFunction',
      L.functions.map((f) => f.name),
    )
    const fn: LogicFunction = {
      id: uniqueId(
        name,
        L.functions.map((f) => f.id),
      ),
      name,
      ...p,
      description: '',
      timeout: '10 s',
      params: [{ name: 'id', type: 'string', req: true }],
      returns: { type: 'object', fields: [{ name: 'ok', type: 'boolean', req: true }] },
      steps: [
        makeStep('set', { name: 'result', value: '{ ok: true }' }),
        makeStep('return', { from: 'var', value: 'result' }),
      ],
    }
    return fn
  }
  if (kind === 'apis') {
    const path = uniqueName(
      '/api/new-endpoint',
      L.apis.map((a) => a.path),
    )
    const api: Api = {
      id: uniqueId(
        `get_${path.replace(/^\/api\//, '')}`,
        L.apis.map((a) => a.id),
      ),
      protocol: 'rest',
      method: 'GET',
      path,
      ...p,
      access: { type: 'token', who: 'any', roles: [], perms: [] },
      request: { contentType: 'application/json', path: [], headers: [], query: [], body: [] },
      responses: {
        '200': { contentType: 'application/json', fields: [{ name: 'ok', type: 'boolean', req: true }] },
        '400': { contentType: 'application/json', fields: [{ name: 'error', type: 'string', req: true }] },
        '401': { contentType: 'application/json', fields: [{ name: 'error', type: 'string', req: true }] },
        '403': { contentType: 'application/json', fields: [{ name: 'error', type: 'string', req: true }] },
        '500': {
          contentType: 'application/json',
          fields: [
            { name: 'error', type: 'string', req: true },
            { name: 'message', type: 'string', req: true },
          ],
        },
      },
      steps: [],
    }
    return api
  }
  if (kind === 'crons') {
    const name = uniqueName(
      'New cron',
      L.crons.map((c) => c.name),
    )
    const cron: Cron = {
      id: uniqueId(
        name,
        L.crons.map((c) => c.id),
      ),
      name,
      ...p,
      schedule: '0 * * * *',
      timezone: def.settings.timezone ?? 'UTC',
      enabled: false,
      steps: [],
    }
    return cron
  }
  const name = uniqueName(
    'new-queue',
    L.queues.map((q) => q.name),
  )
  const q: Queue = {
    id: uniqueId(
      name,
      L.queues.map((x) => x.id),
    ),
    name,
    ...p,
    description: '',
    fields: [{ name: 'id', type: 'string', req: true }],
    consumers: [],
    settings: {
      broker: 'rabbitmq',
      concurrency: 5,
      retries: 3,
      backoff: 'exponential',
      timeout: '30 s',
      ordered: false,
    },
  }
  return q
}
