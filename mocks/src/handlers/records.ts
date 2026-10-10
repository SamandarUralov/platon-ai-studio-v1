/** Mock handlers — table records for the canvas and Preview (Development data only). */
import { http, type HttpHandler } from 'msw'
import type { EnvName, RecordRow, RecordsResponse } from '@platon/definition'
import { api, fail, json, latency, withProject } from '../http'

export const recordsHandlers: HttpHandler[] = [
  http.get(api('/projects/:id/data/tables/:tableId/records'), async ({ params, request }) => {
    await latency(120)
    const url = new URL(request.url)
    const env = (url.searchParams.get('env') ?? 'development') as EnvName
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 100) || 100))
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    return withProject(params.id, (p) => {
      const tableId = String(params.tableId)
      if (!p.definition.data.tables.some((t) => t.id === tableId))
        return fail(404, 'not_found', `Table ${tableId} not found`)
      // Records never move between environments; only Development has seed data in the mocks.
      const all = (env === 'development' ? (p.records[tableId] ?? []) : []) as RecordRow[]
      const hits = q
        ? all.filter((r) =>
            Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)),
          )
        : all
      const body: RecordsResponse = { tableId, env, items: hits.slice(0, limit), total: hits.length }
      return json(body)
    })
  }),
]
