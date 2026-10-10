/** Data-layer API (requirements §6.1: /projects/{id}/data/…). Server state goes through TanStack Query. */
import type {
  DataRow,
  DataStatsResponse,
  PutSecretResponse,
  RemoveTestDataResponse,
  RowsQuery,
  RowsResponse,
  SqlRequest,
  SqlResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  TestDataResponse,
} from '@platon/definition'
import { http } from '@/services/http'
import type { Env } from './lib/model'

const base = (pid: string) => `/projects/${pid}/data`

export const dataKeys = {
  all: (pid: string) => ['data', pid] as const,
  stats: (pid: string, env: Env) => ['data', pid, 'stats', env] as const,
  rows: (pid: string, tableId: string) => ['data', pid, 'rows', tableId] as const,
  rowsQuery: (pid: string, tableId: string, q: RowsQuery) => ['data', pid, 'rows', tableId, q] as const,
}

export const dataApi = {
  async stats(pid: string, env: Env) {
    return (await http.get<DataStatsResponse>(`${base(pid)}/stats`, { params: { env } })).data
  },
  async rows(pid: string, tableId: string, q: RowsQuery) {
    return (await http.get<RowsResponse>(`${base(pid)}/tables/${tableId}/rows`, { params: q })).data
  },
  /** Every row (paged requests), e.g. for CSV export. */
  async allRows(pid: string, tableId: string, q: Omit<RowsQuery, 'offset' | 'limit'>) {
    const out: DataRow[] = []
    for (let offset = 0; ; offset += 500) {
      const page = await dataApi.rows(pid, tableId, { ...q, offset, limit: 500 })
      out.push(...page.items)
      if (out.length >= page.total || !page.items.length) return out
    }
  },
  async createRow(pid: string, tableId: string, values: Record<string, unknown>) {
    return (
      await http.post<DataRow>(
        `${base(pid)}/tables/${tableId}/rows`,
        { values },
        { params: { env: 'development' } },
      )
    ).data
  },
  async updateRow(pid: string, tableId: string, rowId: string, values: Record<string, unknown>) {
    return (
      await http.patch<DataRow>(
        `${base(pid)}/tables/${tableId}/rows/${rowId}`,
        { values },
        { params: { env: 'development' } },
      )
    ).data
  },
  async deleteRow(pid: string, tableId: string, rowId: string) {
    await http.delete(`${base(pid)}/tables/${tableId}/rows/${rowId}`, { params: { env: 'development' } })
  },
  async generate(pid: string, tableId: string, count: number) {
    return (await http.post<TestDataResponse>(`${base(pid)}/test-data`, { tableId, count })).data
  },
  async removeTest(pid: string, tableId: string) {
    return (await http.delete<RemoveTestDataResponse>(`${base(pid)}/test-data`, { params: { tableId } })).data
  },
  async sql(pid: string, req: SqlRequest) {
    return (await http.post<SqlResponse>(`${base(pid)}/sql`, req)).data
  },
  async testConnection(pid: string, req: TestConnectionRequest) {
    return (await http.post<TestConnectionResponse>(`${base(pid)}/test-connection`, req)).data
  },
  async putSecret(pid: string, connId: string, env: Env, value: string) {
    return (
      await http.put<PutSecretResponse>(`${base(pid)}/connections/${connId}/credentials/${env}`, { value })
    ).data
  },
}
