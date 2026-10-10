/** Fake results for ctx.call() in Preview, shaped by the function's declared return type. */
import type { AppDefinition, TypedField } from '@platon/definition'
import type { RecordRow } from '@platon/renderer'
import { workflowState, tableOf } from '@platon/renderer'

function sample(type: string, name: string, fields?: TypedField[]): unknown {
  const arr = /^array<(.+)>$/.exec(type)
  if (arr) return [sample(arr[1]!, name), sample(arr[1]!, name)]
  switch (type) {
    case 'string':
    case 'enum':
      return /tech|name/i.test(name) ? 'Sam Ortiz' : /id$/i.test(name) ? 'wo_1046' : `${name} value`
    case 'number':
    case 'integer':
      return 1
    case 'boolean':
      return true
    case 'date':
      return '2026-10-09'
    case 'datetime':
      return '2026-10-09T10:00:00Z'
    case 'object':
      return Object.fromEntries((fields ?? []).map((f) => [f.name, sample(f.type, f.name, f.fields)]))
    case 'any':
      return null
    default:
      return { id: 'rec_1', name: 'Sample record' }
  }
}

export function mockCall(def: AppDefinition, name: string): unknown {
  const fn = def.logic.functions.find((f) => f.name === name)
  if (!fn) throw new Error(`Function “${name}” does not exist`)
  const r = sample(fn.returns.type, 'result', fn.returns.fields)
  // Page code often reads `.name` from an assignment result; keep it friendly.
  return r && typeof r === 'object' && !Array.isArray(r) ? { name: 'Sam Ortiz', ...r } : r
}

/** ctx.blocks.X.load({ status: 'open' }) → filter rows; 'open' means "not in a final workflow state". */
export function filterByParams(
  def: AppDefinition,
  tableId: string | undefined,
  rows: RecordRow[],
  params: Record<string, unknown> | undefined,
): RecordRow[] {
  if (!params) return rows
  const table = tableOf(def, tableId)
  return rows.filter((r) =>
    Object.entries(params).every(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === 'all') return true
      const f = table?.fields.find((x) => x.key === k)
      if (!f) return true
      if (f.type === 'workflow_state') {
        const s = workflowState(def, f, r[k])
        if (v === 'open') return !s?.final
        const want = String(v).toLowerCase()
        return s
          ? s.id === want ||
              s.name.toLowerCase() === want ||
              (want === 'waiting' && s.id.startsWith('waiting'))
          : false
      }
      return String(r[k] ?? '').toLowerCase() === String(v).toLowerCase()
    }),
  )
}

/** Match a route like "/orders/:id" against "/orders/42". */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.replace(/\/$/, '').split('/')
  const b = path.split('?')[0]!.replace(/\/$/, '').split('/')
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!)
    else if (a[i] !== b[i]) return null
  }
  return params
}
