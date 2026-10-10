/** Development records for the tables a page reads (canvas + Preview share the cache). */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useQueries } from '@tanstack/vue-query'
import type { Page } from '@platon/definition'
import type { RecordRow } from '@platon/renderer'
import { http } from '@/services/http'

/** Mirrors RecordsResponse in @platon/definition (api/records.ts). */
interface RecordsPage {
  items: RecordRow[]
  total: number
}

export async function fetchRecords(
  projectId: string,
  tableId: string,
  params: { q?: string; limit?: number } = {},
): Promise<RecordRow[]> {
  const query = { params: { env: 'development', limit: params.limit ?? 200, q: params.q } }
  const res = await http.get<RecordsPage>(`/projects/${projectId}/data/tables/${tableId}/records`, query)
  if (Array.isArray(res.data?.items)) return res.data.items
  // Same shape as the Data layer's rows endpoint; used until the records endpoint is wired everywhere.
  const rows = await http.get<RecordsPage>(`/projects/${projectId}/data/tables/${tableId}/rows`, query)
  return Array.isArray(rows.data?.items) ? rows.data.items : []
}

/** Table ids a page needs: block sources, link targets of form fields, and the Numbers source. */
export function tablesFor(page: Page | undefined, statsTable?: string): string[] {
  const ids = new Set<string>()
  for (const b of page?.blocks ?? []) {
    const src = (b.props as { source?: unknown }).source
    if (typeof src === 'string' && src) ids.add(src)
    if (b.type === 'stats' && statsTable) ids.add(statsTable)
  }
  return [...ids]
}

export function useTableRecords(projectId: MaybeRefOrGetter<string>, tableIds: MaybeRefOrGetter<string[]>) {
  const queries = useQueries({
    queries: computed(() =>
      toValue(tableIds).map((id) => ({
        queryKey: ['records', toValue(projectId), id],
        queryFn: () => fetchRecords(toValue(projectId), id),
        staleTime: 30_000,
      })),
    ),
  })
  return computed<Record<string, RecordRow[] | undefined>>(() => {
    const out: Record<string, RecordRow[] | undefined> = {}
    toValue(tableIds).forEach((id, i) => (out[id] = queries.value[i]?.data))
    return out
  })
}
