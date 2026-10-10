/** Counters offered by the Numbers block. Keys are stored in block.props.items. */
import type { AppDefinition } from '@platon/definition'
import type { RecordRow } from './context'
import { workflowState } from './format'

export interface StatMeta {
  label: string
  /** Plain-language rule shown in the inspector. */
  rule: string
  accent?: boolean
  count: (rows: RecordRow[], h: { def: AppDefinition; today: string; viewer?: string }) => number
}

const statusIs = (def: AppDefinition, r: RecordRow, pred: (id: string, final: boolean) => boolean) => {
  const f = def.data.tables
    .find((t) => t.id === 'work_orders')
    ?.fields.find((x) => x.type === 'workflow_state')
  const s = workflowState(def, f, r.status)
  return s ? pred(s.id, !!s.final) : false
}

export const STATS: Record<string, StatMeta> = {
  open: {
    label: 'Open jobs',
    rule: 'status != done',
    count: (rows, h) => rows.filter((r) => !statusIs(h.def, r, (_, fin) => fin)).length,
  },
  today: {
    label: 'Due today',
    rule: 'due = today()',
    count: (rows, h) => rows.filter((r) => r.due === h.today).length,
  },
  waiting: {
    label: 'Waiting on parts',
    rule: 'status = waiting_on_parts',
    count: (rows, h) => rows.filter((r) => statusIs(h.def, r, (id) => id === 'waiting_on_parts')).length,
  },
  done: {
    label: 'Completed',
    rule: 'status = done',
    count: (rows, h) => rows.filter((r) => statusIs(h.def, r, (_, fin) => fin)).length,
  },
  urgent: {
    label: 'Urgent',
    rule: 'priority = urgent and status != done',
    accent: true,
    count: (rows) => rows.filter((r) => r.priority === 'Urgent').length,
  },
  mine: {
    label: 'Assigned to me',
    rule: 'technician = current_user()',
    count: (rows, h) => rows.filter((r) => r.tech === h.viewer).length,
  },
}

/** Numbers blocks count the first table with a workflow (work orders in FieldOps). */
export function statsSource(def: AppDefinition): string | undefined {
  return def.workflows[0]?.table ?? def.data.tables[0]?.id
}
