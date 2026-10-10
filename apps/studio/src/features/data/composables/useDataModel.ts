/** Data layer of the definition, derived once per page and shared through props. */
import { computed, inject, provide, type InjectionKey } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { toast, type Tone } from '@platon/ui'
import { ENGINES, type ChangeInput, type DbConnection, type Table } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { dataApi, dataKeys } from '../api'

export function useDataModel() {
  const def = useDefinitionStore()
  const pid = useProjectId()
  const connections = computed<DbConnection[]>(() => def.definition?.data.connections ?? [])
  const tables = computed<Table[]>(() => def.definition?.data.tables ?? [])
  const appSlug = computed(() => def.definition?.settings.slug ?? def.definition?.id ?? 'app')

  const stats = useQuery({
    queryKey: computed(() => dataKeys.stats(pid.value, 'development')),
    queryFn: () => dataApi.stats(pid.value, 'development'),
    enabled: computed(() => !!pid.value),
  })

  const tablesOf = (connId: string) => tables.value.filter((t) => t.connection === connId)
  const connOf = (t: Table | undefined | null) =>
    t ? connections.value.find((c) => c.id === t.connection) : undefined
  const count = (tableId: string) => stats.data.value?.counts[tableId]
  const testCount = (tableId: string) => stats.data.value?.testCounts[tableId] ?? 0
  const workflowStates = (id: string) =>
    def.definition?.workflows?.find((w) => w.id === id)?.states.map((s) => s.name) ?? []
  const workflowTone = (id: string | undefined, state: string): Tone | undefined =>
    (def.definition?.workflows?.find((w) => w.id === id)?.states.find((s) => s.name === state)?.tone as
      Tone | undefined) ?? undefined

  function edit(change: ChangeInput | ChangeInput[], toastText?: string) {
    const ok = def.apply(change)
    if (ok && toastText) toast(toastText, { tone: 'ok' })
    return ok
  }

  return {
    def,
    pid,
    connections,
    tables,
    appSlug,
    stats,
    tablesOf,
    connOf,
    count,
    testCount,
    workflowStates,
    workflowTone,
    edit,
  }
}

export type DataModel = ReturnType<typeof useDataModel>

export function engineMeta(engine: DbConnection['engine']) {
  return ENGINES[engine]
}

const KEY: InjectionKey<DataModel> = Symbol('data-model')

/** Called once by DataPage; children read it with `useData()`. */
export function provideDataModel(): DataModel {
  const m = useDataModel()
  provide(KEY, m)
  return m
}

export function useData(): DataModel {
  const m = inject(KEY)
  if (!m) throw new Error('useData() needs provideDataModel() in DataPage')
  return m
}
