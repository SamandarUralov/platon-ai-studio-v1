/**
 * Mock handlers — data layer (requirements §3.4, §6.1): record browsing per environment,
 * row edits and test data (Development only), SQL console, connection tests, write-only secrets.
 */
import { http } from 'msw'
import {
  newId,
  type DataRow,
  type DataStatsResponse,
  type EnvName,
  type PutSecretRequest,
  type PutSecretResponse,
  type RemoveTestDataResponse,
  type RowWriteRequest,
  type RowsResponse,
  type SqlRequest,
  type SqlResponse,
  type TestConnectionRequest,
  type TestConnectionResponse,
  type TestDataRequest,
  type TestDataResponse,
} from '@platon/definition'
import { persist, type ProjectState } from '../db'
import { api, body, fail, json, latency, withProject } from '../http'
import { generateRows, runSelect, SqlError } from '../seed/data'

const ENVS: EnvName[] = ['development', 'staging', 'production']
const asEnv = (v: string | null): EnvName => (ENVS.includes(v as EnvName) ? (v as EnvName) : 'development')

/**
 * Records belong to an environment. The mock keeps real rows only for Development; other
 * environments return a deterministic slice so the UI can show that they differ.
 */
function rowsFor(p: ProjectState, tableId: string, env: EnvName): DataRow[] {
  const all = (p.records[tableId] ?? []) as DataRow[]
  if (env === 'development') return all
  const real = all.filter((r) => !r._test)
  return env === 'staging' ? real.slice(0, Math.ceil(real.length / 2)) : real
}

function tableOf(p: ProjectState, tableId: string) {
  return p.definition.data.tables.find((t) => t.id === tableId)
}

const devOnly = (env: EnvName) =>
  env === 'development'
    ? null
    : fail(403, 'env_read_only', 'Records outside Development are read-only in Studio.')

/** Keep only values for known fields; never let the client set ids or the test marker. */
function clean(p: ProjectState, tableId: string, values: Record<string, unknown>): Record<string, unknown> {
  const keys = new Set(tableOf(p, tableId)?.fields.map((f) => f.key) ?? [])
  return Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => keys.has(k)))
}

export const dataHandlers = [
  http.get(api('/projects/:id/data/stats'), async ({ params, request }) => {
    await latency(80)
    const env = asEnv(new URL(request.url).searchParams.get('env'))
    return withProject(params.id, (p) => {
      const counts: Record<string, number> = {}
      const testCounts: Record<string, number> = {}
      for (const t of p.definition.data.tables) {
        const rows = rowsFor(p, t.id, env)
        counts[t.id] = rows.length
        testCounts[t.id] = rows.filter((r) => r._test).length
      }
      return json<DataStatsResponse>({ env, counts, testCounts })
    })
  }),

  http.get(api('/projects/:id/data/tables/:tableId/rows'), async ({ params, request }) => {
    await latency(140)
    const u = new URL(request.url).searchParams
    const env = asEnv(u.get('env'))
    const offset = Math.max(0, Number(u.get('offset') ?? 0) || 0)
    const limit = Math.min(500, Math.max(1, Number(u.get('limit') ?? 100) || 100))
    const q = (u.get('q') ?? '').trim().toLowerCase()
    const sort = u.get('sort')
    const dir = u.get('dir') === 'desc' ? -1 : 1
    return withProject(params.id, (p) => {
      const tableId = String(params.tableId)
      if (!tableOf(p, tableId)) return fail(404, 'not_found', `Table ${tableId} not found`)
      let rows = rowsFor(p, tableId, env)
      if (q)
        rows = rows.filter((r) =>
          Object.entries(r).some(
            ([k, v]) =>
              k !== 'id' &&
              String(v ?? '')
                .toLowerCase()
                .includes(q),
          ),
        )
      if (sort) {
        rows = [...rows].sort((a, b) => {
          const x = a[sort]
          const y = b[sort]
          const nx = Number(String(x ?? '').replace(/[$,]/g, ''))
          const ny = Number(String(y ?? '').replace(/[$,]/g, ''))
          const c =
            x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny)
              ? nx - ny
              : String(x ?? '').localeCompare(String(y ?? ''))
          return c * dir
        })
      }
      return json<RowsResponse>({ items: rows.slice(offset, offset + limit), total: rows.length, offset })
    })
  }),

  http.post(api('/projects/:id/data/tables/:tableId/rows'), async ({ params, request }) => {
    await latency(160)
    const env = asEnv(new URL(request.url).searchParams.get('env'))
    const req = await body<RowWriteRequest>(request)
    return withProject(params.id, (p) => {
      const tableId = String(params.tableId)
      const table = tableOf(p, tableId)
      if (!table) return fail(404, 'not_found', `Table ${tableId} not found`)
      const denied = devOnly(env)
      if (denied) return denied
      const values = clean(p, tableId, req.values)
      const missing = table.fields.filter(
        (f) => f.req && f.type !== 'auto_number' && (values[f.key] === undefined || values[f.key] === ''),
      )
      if (missing.length)
        return fail(
          422,
          'validation',
          `${missing.map((f) => f.name).join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`,
          missing.map((f) => ({ path: f.key, problem: 'required' })),
        )
      const rows = (p.records[tableId] ??= [])
      const auto = table.fields.filter((f) => f.type === 'auto_number')
      for (const f of auto) {
        const max = rows.reduce(
          (m, r) => Math.max(m, Number(/(\d+)$/.exec(String(r[f.key] ?? ''))?.[1] ?? 0)),
          1000,
        )
        const prefix = /^(.*?)\d+$/.exec(String(rows[0]?.[f.key] ?? ''))?.[1] ?? ''
        values[f.key] = `${prefix}${max + 1}`
      }
      const row: DataRow = { id: newId('rec'), ...values }
      rows.push(row)
      persist()
      return json<DataRow>(row, { status: 201 })
    })
  }),

  http.patch(api('/projects/:id/data/tables/:tableId/rows/:rowId'), async ({ params, request }) => {
    await latency(140)
    const env = asEnv(new URL(request.url).searchParams.get('env'))
    const req = await body<RowWriteRequest>(request)
    return withProject(params.id, (p) => {
      const tableId = String(params.tableId)
      const denied = devOnly(env)
      if (denied) return denied
      const rows = p.records[tableId] ?? []
      const i = rows.findIndex((r) => r.id === params.rowId)
      if (i < 0) return fail(404, 'not_found', 'Record not found')
      rows[i] = { ...rows[i], ...clean(p, tableId, req.values) }
      persist()
      return json<DataRow>(rows[i] as DataRow)
    })
  }),

  http.delete(api('/projects/:id/data/tables/:tableId/rows/:rowId'), async ({ params, request }) => {
    await latency(120)
    const env = asEnv(new URL(request.url).searchParams.get('env'))
    return withProject(params.id, (p) => {
      const denied = devOnly(env)
      if (denied) return denied
      const tableId = String(params.tableId)
      const rows = p.records[tableId] ?? []
      const i = rows.findIndex((r) => r.id === params.rowId)
      if (i < 0) return fail(404, 'not_found', 'Record not found')
      rows.splice(i, 1)
      persist()
      return json({ ok: true })
    })
  }),

  http.post(api('/projects/:id/data/test-data'), async ({ params, request }) => {
    await latency(500)
    const req = await body<TestDataRequest>(request)
    return withProject(params.id, (p) => {
      const table = tableOf(p, req.tableId)
      if (!table) return fail(404, 'not_found', `Table ${req.tableId} not found`)
      const count = Math.min(1000, Math.max(1, Number(req.count) || 10))
      const rows = generateRows(table, p.definition, p.records, count)
      p.records[table.id] = [...(p.records[table.id] ?? []), ...rows]
      persist()
      return json<TestDataResponse>({ added: rows.length, total: p.records[table.id]!.length })
    })
  }),

  http.delete(api('/projects/:id/data/test-data'), async ({ params, request }) => {
    await latency(200)
    const tableId = new URL(request.url).searchParams.get('tableId') ?? ''
    return withProject(params.id, (p) => {
      const rows = (p.records[tableId] ?? []) as DataRow[]
      const kept = rows.filter((r) => !r._test)
      p.records[tableId] = kept
      persist()
      return json<RemoveTestDataResponse>({ removed: rows.length - kept.length })
    })
  }),

  http.post(api('/projects/:id/data/sql'), async ({ params, request }) => {
    await latency(220)
    const req = await body<SqlRequest>(request)
    return withProject(params.id, (p) => {
      if (asEnv(req.env) !== 'development')
        return fail(
          403,
          'env_forbidden',
          'The SQL console runs on Development only. Ask an admin to enable read-only access to other environments.',
        )
      const conn = p.definition.data.connections.find((c) => c.id === req.connectionId)
      if (!conn) return fail(404, 'not_found', 'Database connection not found')
      const started = performance.now()
      try {
        const tables = p.definition.data.tables.filter((t) => t.connection === conn.id)
        const res = runSelect(req.sql ?? '', tables, p.records)
        return json<SqlResponse>({
          ...res,
          elapsedMs: Math.max(1, Math.round(performance.now() - started + 3 + Math.random() * 9)),
        })
      } catch (e) {
        if (e instanceof SqlError) return fail(400, 'sql_error', e.message)
        throw e
      }
    })
  }),

  http.post(api('/projects/:id/data/test-connection'), async ({ params, request }) => {
    await latency(600)
    const req = await body<TestConnectionRequest>(request)
    return withProject(params.id, (p) => {
      const env = asEnv(req.env)
      const conn = req.connectionId
        ? p.definition.data.connections.find((c) => c.id === req.connectionId)
        : undefined
      if (req.connectionId && !conn) return fail(404, 'not_found', 'Database connection not found')
      const host = conn?.host ?? req.host ?? (req.uri ? 'uri' : '')
      const engine = conn?.engine ?? req.engine ?? 'postgres'
      const res = (ok: boolean, message: string): Response =>
        json<TestConnectionResponse>({
          ok,
          message,
          latencyMs: ok ? 8 + Math.round(Math.random() * 30) : 0,
          serverVersion: ok
            ? {
                postgres: 'PostgreSQL 16.4',
                mysql: 'MySQL 8.4.2',
                mssql: 'SQL Server 2022',
                mongo: 'MongoDB 7.0.12',
                redis: 'Redis 7.4.0',
              }[engine]
            : undefined,
        })
      if (!host) return res(false, 'Host is required.')
      if (/fail|invalid|unknown/.test(host)) return res(false, `Could not resolve host “${host}”.`)
      if (conn && !conn.credentials?.[env])
        return res(false, `No credentials for ${env[0]!.toUpperCase()}${env.slice(1)}. Add them first.`)
      if (!conn && !req.uri && req.password === '') return res(false, 'Password authentication failed.')
      return res(true, 'Connected')
    })
  }),

  http.put(api('/projects/:id/data/connections/:connId/credentials/:env'), async ({ params, request }) => {
    await latency(200)
    const req = await body<PutSecretRequest>(request)
    return withProject(params.id, () => {
      const env = asEnv(String(params.env))
      if (!req.value) return fail(422, 'validation', 'Secret value is required')
      // The value is stored in the vault and never echoed back — only its reference.
      return json<PutSecretResponse>({
        ref: `secret://${String(params.connId)}/${env}`,
        updatedAt: new Date().toISOString(),
      })
    })
  }),
]
