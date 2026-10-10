/** Rows a data block shows: runtime override → loaded records, then filter + record condition. */
import { computed, type ComputedRef } from 'vue'
import type { Table } from '@platon/definition'
import type { RecordRow } from '../context'
import { filterRows, tableOf } from '../format'
import { applyRecordCondition } from '../visibility'
import { type BlockProps, list, str, type ResolvedProps } from './props'

export function useRows(p: BlockProps, r: ComputedRef<ResolvedProps>) {
  const table = computed<Table | undefined>(() => tableOf(p.ctx.definition, str(r.value.source)))
  const columns = computed(() => {
    const cols = list(r.value.columns)
    return cols.length ? cols : (table.value?.fields.slice(0, 4).map((f) => f.key) ?? [])
  })
  const loaded = computed(
    () => Array.isArray(r.value.rows) || !!(table.value && p.ctx.records[table.value.id]),
  )
  const rows = computed<RecordRow[]>(() => {
    const def = p.ctx.definition
    if (Array.isArray(r.value.rows)) return r.value.rows as RecordRow[]
    const base = (table.value && p.ctx.records[table.value.id]) || []
    return applyRecordCondition(
      def,
      p.block,
      filterRows(def, table.value, base, r.value.filter, p.ctx.viewer?.name),
    )
  })
  return { table, columns, rows, loaded }
}
