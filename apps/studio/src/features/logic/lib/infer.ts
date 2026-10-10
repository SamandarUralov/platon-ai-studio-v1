/**
 * Variable inference and Return checks (requirements §3.3): what is in scope before a layer, and
 * whether a Return's source fits the declared return type.
 */
import {
  formatType,
  typeFits,
  type LogicFunction,
  type ReturnType,
  type Step,
  type TypedField,
} from '@platon/definition'
import { splitArgs } from '@platon/validators'

const PLAIN = new Set(['string', 'number', 'integer', 'boolean', 'object', 'any', 'date', 'datetime'])

export interface ScopeVar {
  name: string
  type: string
  fields?: TypedField[]
  /** Where it comes from: "parameter", "Select query", "calcSlaDue()" … */
  source: string
  /** Set by a Function layer (preferred default for Return). */
  fromCall?: boolean
}

/**
 * Variables set before `stopId` (all variables when it isn't found). Later definitions of the same
 * name win, like at runtime.
 */
export function inferVars(
  steps: Step[],
  stopId: string | null,
  params: TypedField[],
  functions: LogicFunction[],
  tables: string[] = [],
): ScopeVar[] {
  const out: ScopeVar[] = params.map((p) => ({
    name: `input.${p.name}`,
    type: p.type,
    fields: p.fields,
    source: 'parameter',
  }))
  let done = false
  const walk = (list: Step[]) => {
    for (const s of list) {
      if (done) return
      if (s.id === stopId) {
        done = true
        return
      }
      const c = s.config
      if (s.type === 'select' && c.into) {
        const t = `${String(c.limit).trim() === '1' ? 'row' : 'array'}<${c.table || 'table'}>`
        out.push({ name: c.into, type: t, source: 'Select query' })
      } else if (s.type === 'http' && c.into)
        out.push({ name: c.into, type: 'object', source: 'HTTP request' })
      else if (s.type === 'consume' && c.into)
        out.push({ name: c.into, type: 'object', source: 'MQ consume' })
      else if (s.type === 'set' && c.name) out.push({ name: c.name, type: 'any', source: 'Set variable' })
      else if (s.type === 'call' && c.into) {
        const f = functions.find((x) => x.name === c.fn)
        out.push({
          name: c.into,
          type: f?.returns.type ?? 'any',
          fields: f?.returns.fields,
          source: `${c.fn || 'function'}()`,
          fromCall: true,
        })
      } else if (s.type === 'for' && c.as) {
        const list2 = [...out].reverse().find((v) => v.name === c.list)
        const m = list2 && /^array<(.+)>$/.exec(list2.type)
        const inner = m ? m[1]! : 'any'
        // array<string|number|object> holds plain values; array<some_table> holds rows of that table.
        const t = PLAIN.has(inner) && !tables.includes(inner) ? inner : `row<${inner}>`
        out.push({
          name: c.as,
          type: t,
          fields: list2?.type === 'array<object>' ? list2.fields : undefined,
          source: 'For each',
        })
      }
      for (const b of s.branches ?? []) walk(b.steps)
    }
  }
  walk(steps)
  const m = new Map<string, ScopeVar>()
  for (const v of out) {
    m.delete(v.name)
    m.set(v.name, v)
  }
  return [...m.values()]
}

export interface ReturnCheck {
  vars: ScopeVar[]
  /** Variable used when the layer doesn't name one (the last function result). */
  defaultVar: string
  expected: string
  source?: string
  mode: 'var' | 'fn'
  isVoid?: boolean
  error?: string
  warning?: string
}

function fits(a: string, af: TypedField[] | undefined, b: ReturnType): string {
  return typeFits(a, af, b.type, b.fields)
}

export function checkReturn(
  fn: Pick<LogicFunction, 'params' | 'returns'>,
  step: Step,
  steps: Step[],
  functions: LogicFunction[],
): ReturnCheck {
  const c = step.config
  const mode = c.from === 'fn' ? 'fn' : 'var'
  const vars = inferVars(steps, step.id, fn.params, functions)
  const rev = [...vars].reverse()
  const defaultVar = (rev.find((v) => v.fromCall) ?? rev.find((v) => v.source !== 'parameter'))?.name ?? ''
  const res: ReturnCheck = {
    vars,
    defaultVar,
    expected: formatType(fn.returns.type, fn.returns.fields),
    mode,
  }
  if (fn.returns.type === 'void') return { ...res, isVoid: true, source: 'nothing' }

  let srcType: string
  let srcFields: TypedField[] | undefined
  if (mode === 'var') {
    const name = c.value || defaultVar
    if (!name) return { ...res, error: 'Nothing to return yet. Add a layer that saves a result first.' }
    const v = vars.find((x) => x.name === name)
    if (!v) return { ...res, error: `“${name}” is not set before this layer.` }
    srcType = v.type
    srcFields = v.fields
  } else {
    const f = functions.find((x) => x.name === c.fn)
    if (!f) return { ...res, error: 'Choose a function to return.' }
    const need = f.params.filter((p) => p.req).length
    const got = splitArgs(c.args).length
    if (got < need || got > f.params.length)
      return {
        ...res,
        source: formatType(f.returns.type, f.returns.fields),
        error: `${f.name} expects ${need === f.params.length ? need : `${need}–${f.params.length}`} argument${f.params.length === 1 ? '' : 's'}, gets ${got}.`,
      }
    srcType = f.returns.type
    srcFields = f.returns.fields
  }
  const source = formatType(srcType, srcFields)
  const err = fits(srcType, srcFields, fn.returns)
  if (err) return { ...res, source, error: err }
  if (srcType === 'any') return { ...res, source, warning: 'Type is unknown until runtime.' }
  return { ...res, source }
}

/** "(order_id: string, trade: string) → datetime" */
export function signature(fn: Pick<LogicFunction, 'params' | 'returns'>): string {
  return `(${fn.params.map((p) => `${p.name}${p.req ? '' : '?'}: ${formatType(p.type, p.fields)}`).join(', ')}) → ${formatType(fn.returns.type, fn.returns.fields)}`
}

/** Default call arguments for a function: `input.a, input.b`. */
export function defaultArgs(fn: Pick<LogicFunction, 'params'>): string {
  return fn.params.map((p) => `input.${p.name}`).join(', ')
}
