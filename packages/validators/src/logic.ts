/** Checks for functions, APIs, crons and queues (requirements §3.3 "Problems"). */
import {
  formatType,
  pathParams,
  pointer,
  typeFits,
  walkSteps,
  type AppDefinition,
  type LogicFunction,
  type Problem,
  type Step,
  type TypedField,
} from '@platon/definition'

export function splitArgs(args: string | undefined): string[] {
  const s = (args ?? '').trim()
  if (!s) return []
  // Split on top-level commas only, so `{ a, b }` and `f(x, y)` count as one argument.
  const out: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const INPUT_REF = /\binput\.([a-zA-Z_]\w*)/g

function inputRefs(step: Step): string[] {
  const out: string[] = []
  for (const v of Object.values(step.config)) for (const m of String(v).matchAll(INPUT_REF)) out.push(m[1]!)
  return out
}

interface Ctx {
  def: AppDefinition
  fnByName: Map<string, LogicFunction>
  queueIds: Set<string>
  tableIds: Set<string>
}

function checkSteps(
  ctx: Ctx,
  steps: Step[],
  base: (string | number)[],
  inputs: TypedField[],
  out: Problem[],
  opts: { returns?: LogicFunction['returns']; kind: 'function' | 'api' | 'cron' },
) {
  const declared = new Set(inputs.map((p) => p.name))
  const used = new Set<string>()
  const vars = new Map<string, { type: string; fields?: TypedField[] }>()
  for (const p of inputs) vars.set(`input.${p.name}`, { type: p.type, fields: p.fields })

  walkSteps(steps, (s) => {
    const at = pointer(...base, 'steps', s.id)
    for (const name of inputRefs(s)) {
      used.add(name)
      if (!declared.has(name))
        out.push({
          severity: 'error',
          code: 'undeclared_input',
          message: `input.${name} is not a declared parameter`,
          path: at,
        })
    }
    if (s.type === 'call' || (s.type === 'return' && s.config.from === 'fn')) {
      const name = s.config.fn
      if (!name)
        out.push({
          severity: 'error',
          code: 'missing_function',
          message: 'Choose a function to call',
          path: at,
        })
      else {
        const target = ctx.fnByName.get(name)
        if (!target)
          out.push({
            severity: 'error',
            code: 'unknown_function',
            message: `Function “${name}” does not exist`,
            path: at,
          })
        else {
          const got = splitArgs(s.config.args).length
          const want = target.params.filter((p) => p.req).length
          const max = target.params.length
          if (got < want || got > max)
            out.push({
              severity: 'error',
              code: 'arg_count',
              message: `${name} expects ${want === max ? want : `${want}–${max}`} argument${max === 1 ? '' : 's'}, got ${got}`,
              path: at,
            })
          if (s.config.into)
            vars.set(s.config.into, { type: target.returns.type, fields: target.returns.fields })
        }
      }
    }
    if ((s.type === 'produce' || s.type === 'consume') && s.config.queue && !ctx.queueIds.has(s.config.queue))
      out.push({
        severity: 'error',
        code: 'unknown_queue',
        message: `Queue “${s.config.queue}” does not exist`,
        path: at,
      })
    if (
      s.type === 'select' &&
      s.config.table &&
      !ctx.tableIds.has(s.config.table) &&
      s.config.table !== 'sites'
    )
      out.push({
        severity: 'warning',
        code: 'unknown_table',
        message: `Table “${s.config.table}” is not in the data layer`,
        path: at,
      })
    if (s.type === 'select' && s.config.into) vars.set(s.config.into, { type: `array<${s.config.table}>` })
    if (s.type === 'set' && s.config.name) vars.set(s.config.name, { type: 'any' })
    if (s.type === 'return' && opts.returns && s.config.from !== 'fn') {
      const v = vars.get(s.config.value || 'result')
      if (!v && s.config.value)
        out.push({
          severity: 'error',
          code: 'return_unknown',
          message: `“${s.config.value}” is used before it is set`,
          path: at,
        })
      else if (v) {
        const why = typeFits(v.type, v.fields, opts.returns.type, opts.returns.fields)
        if (why)
          out.push({
            severity: 'error',
            code: 'return_type',
            message: `Return ${formatType(opts.returns.type)}: ${why}`,
            path: at,
          })
      }
    }
  })

  if (opts.kind === 'function')
    for (const p of inputs)
      if (!used.has(p.name))
        out.push({
          severity: 'warning',
          code: 'unused_param',
          message: `Parameter “${p.name}” is never used`,
          path: pointer(...base, 'params', p.name),
        })
}

export function validateLogic(def: AppDefinition): Problem[] {
  const out: Problem[] = []
  const ctx: Ctx = {
    def,
    fnByName: new Map(def.logic.functions.map((f) => [f.name, f])),
    queueIds: new Set(def.logic.queues.map((q) => q.id)),
    tableIds: new Set(def.data.tables.map((t) => t.id)),
  }

  const names = new Map<string, number>()
  for (const f of def.logic.functions) names.set(f.name, (names.get(f.name) ?? 0) + 1)

  for (const f of def.logic.functions) {
    const base = ['logic', 'functions', f.id]
    if ((names.get(f.name) ?? 0) > 1)
      out.push({
        severity: 'error',
        code: 'duplicate_name',
        message: `Another function is also called “${f.name}”`,
        path: pointer(...base, 'name'),
      })
    if (!f.steps.some((s) => s.type === 'return') && f.returns.type !== 'any')
      out.push({
        severity: 'warning',
        code: 'no_return',
        message: `${f.name} declares ${f.returns.type} but never returns`,
        path: pointer(...base),
      })
    checkSteps(ctx, f.steps, base, f.params, out, { returns: f.returns, kind: 'function' })
  }

  for (const a of def.logic.apis) {
    const base = ['logic', 'apis', a.id]
    const inputs = [...a.request.path, ...a.request.query, ...a.request.headers, ...a.request.body]
    checkSteps(ctx, a.steps, base, inputs, out, { kind: 'api' })
    if (a.protocol === 'rest')
      for (const p of pathParams(a.path))
        if (!a.request.path.some((x) => x.name === p))
          out.push({
            severity: 'error',
            code: 'path_param',
            message: `Path parameter :${p} is not declared in Request · Path`,
            path: pointer(...base, 'request', 'path'),
          })
    if (
      a.access.type !== 'public' &&
      a.access.who === 'roles' &&
      !a.access.roles?.length &&
      !a.access.perms?.length
    )
      out.push({
        severity: 'error',
        code: 'access_empty',
        message: 'Pick at least one role or permission, or allow anyone signed in',
        path: pointer(...base, 'access'),
      })
    if (!a.steps.length)
      out.push({
        severity: 'warning',
        code: 'empty_api',
        message: 'This API does nothing yet',
        path: pointer(...base, 'steps'),
      })
  }

  for (const c of def.logic.crons) {
    const base = ['logic', 'crons', c.id]
    if (c.schedule.trim().split(/\s+/).length !== 5)
      out.push({
        severity: 'error',
        code: 'cron_schedule',
        message: 'Schedule needs 5 parts: minute hour day month weekday',
        path: pointer(...base, 'schedule'),
      })
    checkSteps(ctx, c.steps, base, [], out, { kind: 'cron' })
  }

  for (const q of def.logic.queues) {
    const base = ['logic', 'queues', q.id]
    for (const c of q.consumers)
      if (!ctx.fnByName.has(c))
        out.push({
          severity: 'error',
          code: 'unknown_consumer',
          message: `Consumer “${c}” does not exist`,
          path: pointer(...base, 'consumers'),
        })
    if (!q.consumers.length)
      out.push({
        severity: 'warning',
        code: 'no_consumer',
        message: 'Messages will wait forever: no consumer attached',
        path: pointer(...base, 'consumers'),
      })
  }
  return out
}
