/** Record formatting shared by table, list, detail and form blocks. */
import type { AppDefinition, Table, TableField } from '@platon/definition'
import type { AppTone } from './theme'
import type { RecordRow } from './context'

export interface Cell {
  text: string
  /** Render as a pill with this tone (workflow states, selects). */
  tone?: AppTone
  muted?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(v: string, withTime = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(v)
  if (!m) return v
  const d = `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
  return withTime && m[4] ? `${d}, ${m[4]}:${m[5]}` : d
}

export function formatNumber(v: unknown, digits?: number): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  return n.toLocaleString(
    'en-US',
    digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  )
}

export function tableOf(def: AppDefinition, id: string | undefined): Table | undefined {
  return id ? def.data.tables.find((t) => t.id === id) : undefined
}

export function fieldOf(table: Table | undefined, key: string): TableField | undefined {
  return table?.fields.find((f) => f.key === key)
}

/** Workflow state for a value (by state id or display name). */
export function workflowState(def: AppDefinition, field: TableField | undefined, value: unknown) {
  if (!field || field.type !== 'workflow_state' || typeof value !== 'string') return undefined
  const wf = def.workflows.find((w) => w.id === field.workflow) ?? def.workflows.find((w) => w.table)
  const v = value.toLowerCase()
  return wf?.states.find((s) => s.id === v || s.name.toLowerCase() === v)
}

const SELECT_TONES: AppTone[] = ['primary', 'teal', 'purple', 'warn', 'info', 'neutral']

export function formatCell(def: AppDefinition, field: TableField | undefined, value: unknown): Cell {
  if (value === null || value === undefined || value === '') return { text: '—', muted: true }
  if (!field) return { text: Array.isArray(value) ? value.join(', ') : String(value) }
  switch (field.type) {
    case 'workflow_state': {
      const s = workflowState(def, field, value)
      return { text: s?.name ?? String(value), tone: (s?.tone as AppTone | undefined) ?? 'neutral' }
    }
    case 'single_select': {
      const i = field.options?.indexOf(String(value)) ?? -1
      return { text: String(value), tone: i >= 0 ? SELECT_TONES[i % SELECT_TONES.length] : 'neutral' }
    }
    case 'date':
      return { text: formatDate(String(value)) }
    case 'datetime':
      return { text: formatDate(String(value), true) }
    case 'checkbox':
      return { text: value === true || value === 'true' ? 'Yes' : 'No' }
    case 'number':
      return { text: formatNumber(value) }
    case 'currency':
      return { text: typeof value === 'number' ? `$${formatNumber(value, 2)}` : String(value) }
    case 'auto_number':
      return { text: String(value), muted: true }
    case 'multi_select':
      return { text: Array.isArray(value) ? value.join(', ') : String(value) }
    case 'json':
      return { text: typeof value === 'string' ? value : JSON.stringify(value) }
    default:
      return { text: Array.isArray(value) ? value.join(', ') : String(value) }
  }
}

export function columnLabel(table: Table | undefined, key: string): string {
  return fieldOf(table, key)?.name ?? key
}

/** Rows for a data block after its record filter ('none' | 'open' | 'mine'). */
export function filterRows(
  def: AppDefinition,
  table: Table | undefined,
  rows: RecordRow[],
  filter: unknown,
  viewerName?: string,
): RecordRow[] {
  if (filter === 'open') {
    const status = table?.fields.find((f) => f.type === 'workflow_state')
    if (!status) return rows
    return rows.filter((r) => !workflowState(def, status, r[status.key])?.final)
  }
  if (filter === 'mine' && viewerName) {
    const who = table?.fields.find((f) => f.type === 'user_account' || f.link === 'technicians')
    return who ? rows.filter((r) => r[who.key] === viewerName) : rows
  }
  return rows
}

export function searchRows(rows: RecordRow[], q: string): RecordRow[] {
  const s = q.trim().toLowerCase()
  if (!s) return rows
  return rows.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(s)),
  )
}
