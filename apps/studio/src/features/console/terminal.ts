/**
 * The Development shell in the console dock. Pure: parsing, formatting and command dispatch take
 * their I/O through `ShellContext`, so everything here is unit-tested without a server.
 */
import {
  ENGINES,
  type AppDefinition,
  type ShellCallResponse,
  type ShellQueryResponse,
} from '@platon/definition'

export type LineTone = 'cmd' | 'out' | 'muted' | 'ok' | 'err' | 'accent'

export interface ShellLine {
  text: string
  tone: LineTone
}

export interface ParsedCommand {
  name: string
  args: string[]
  /** Everything after the command name, untouched (for SQL and JSON). */
  rest: string
}

export const COMMANDS: { usage: string; desc: string }[] = [
  { usage: 'help', desc: 'Show commands' },
  { usage: 'dbs', desc: 'List database connections' },
  { usage: 'tables [db]', desc: 'List tables' },
  { usage: 'fns', desc: 'List functions and their parameters' },
  { usage: 'call <fn> [args]', desc: 'Run a function: key=value pairs, JSON or positional' },
  { usage: 'query <sql>', desc: "SELECT … FROM <table> [WHERE col = 'v'] [LIMIT n]" },
  { usage: 'test [filter]', desc: 'Run tests (results in the Tests tab)' },
  { usage: 'problems', desc: 'Show definition problems' },
  { usage: 'env', desc: 'Show environment' },
  { usage: 'clear', desc: 'Clear the screen' },
]

/** Split a line into words; quotes group words, and {…}/[…] stay one token so JSON survives. */
export function tokenize(input: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let depth = 0
  let inStr = false
  let started = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (depth > 0) {
      cur += ch
      if (inStr) {
        if (ch === '\\') cur += input[++i] ?? ''
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') depth--
      continue
    }
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (ch === '{' || ch === '[') {
      depth++
      cur += ch
      started = true
    } else if (/\s/.test(ch)) {
      if (started) out.push(cur)
      cur = ''
      started = false
    } else {
      cur += ch
      started = true
    }
  }
  if (started) out.push(cur)
  return out
}

export function parseCommand(line: string): ParsedCommand | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const m = /^(\S+)\s*([\s\S]*)$/.exec(trimmed)!
  return { name: m[1]!.toLowerCase(), args: tokenize(m[2]!), rest: m[2]! }
}

function coerce(v: string): unknown {
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (/^[[{]/.test(v)) {
    try {
      return JSON.parse(v) as unknown
    } catch {
      return v
    }
  }
  return v
}

/**
 * Turn `call` arguments into a named-argument object.
 * Accepts `{"a":1}`, `a=1 b="x y"`, or positional values in parameter order.
 */
export function parseCallArgs(params: string[], args: string[]): Record<string, unknown> {
  if (args.length === 1 && args[0]!.startsWith('{')) {
    const v = JSON.parse(args[0]!) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Arguments must be a JSON object')
    return v as Record<string, unknown>
  }
  const out: Record<string, unknown> = {}
  let pos = 0
  for (const a of args) {
    const kv = /^([A-Za-z_][\w]*)=([\s\S]*)$/.exec(a)
    if (kv) out[kv[1]!] = coerce(kv[2]!)
    else {
      const name = params[pos++]
      if (!name) throw new Error(`Too many arguments — expected ${params.length}`)
      out[name] = coerce(a)
    }
  }
  return out
}

/** Fixed-width text table. */
export function formatTable(columns: string[], rows: Record<string, unknown>[], width = 18): string[] {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return (s.length > width - 2 ? s.slice(0, width - 3) + '…' : s).padEnd(width)
  }
  return [
    columns
      .map((c) => cell(c))
      .join('')
      .trimEnd(),
    ...rows.map((r) =>
      columns
        .map((c) => cell(r[c]))
        .join('')
        .trimEnd(),
    ),
  ]
}

/** ↑/↓ through history. `index === history.length` means the fresh (empty) line. */
export function historyStep(history: string[], index: number, dir: -1 | 1): { index: number; value: string } {
  if (!history.length) return { index: 0, value: '' }
  const i = Math.max(0, Math.min(history.length, index + dir))
  return { index: i, value: history[i] ?? '' }
}

export interface ShellContext {
  def: AppDefinition
  env: string
  role: string
  projectName: string
  problems: { severity: string; message: string; path: string }[]
  call: (fn: string, args: Record<string, unknown>) => Promise<ShellCallResponse>
  query: (sql: string) => Promise<ShellQueryResponse>
  /** Starts tests; returns how many matched. */
  runTests: (filter: string) => number
  errorText: (e: unknown) => string
}

export type ShellOutput = ShellLine[] | 'clear'

const L = (text: string, tone: LineTone = 'out'): ShellLine => ({ text, tone })

export async function execute(line: string, ctx: ShellContext): Promise<ShellOutput> {
  const cmd = parseCommand(line)
  if (!cmd) return []
  const { def } = ctx
  switch (cmd.name) {
    case 'help':
      return COMMANDS.map((c) => L(`${c.usage.padEnd(20)}${c.desc}`, 'accent'))
    case 'clear':
    case 'cls':
      return 'clear'
    case 'dbs':
      return def.data.connections.map((c) => {
        const n = def.data.tables.filter((t) => t.connection === c.id).length
        return L(
          `● ${c.id.padEnd(14)}${ENGINES[c.engine].label.padEnd(12)}${c.role.padEnd(10)}${n} ${ENGINES[c.engine].unit}${n === 1 ? '' : 's'}`,
          'ok',
        )
      })
    case 'tables': {
      const db = cmd.args[0]
      if (db && !def.data.connections.some((c) => c.id === db))
        return [L(`Database not found: ${db}. Try dbs.`, 'err')]
      const list = def.data.tables.filter((t) => !db || t.connection === db)
      return [
        ...list.map((t) => L(`  ${t.id.padEnd(22)}${t.connection.padEnd(10)}${t.fields.length} fields`)),
        L(`${list.length} table${list.length === 1 ? '' : 's'}`, 'muted'),
      ]
    }
    case 'fns':
      return def.logic.functions.map((f) =>
        L(
          `  ${f.name}(${f.params.map((p) => `${p.name}${p.req ? '' : '?'}: ${p.type}`).join(', ')}) → ${f.returns.type}`,
        ),
      )
    case 'call': {
      const name = cmd.args[0]
      if (!name) return [L('Usage: call <fn> [args]', 'err')]
      const fn = def.logic.functions.find((f) => f.name === name || f.id === name)
      if (!fn) return [L(`Function not found: ${name}. Try fns.`, 'err')]
      let args: Record<string, unknown>
      try {
        args = parseCallArgs(
          fn.params.map((p) => p.name),
          cmd.args.slice(1),
        )
      } catch (e) {
        return [L(ctx.errorText(e), 'err')]
      }
      try {
        const res = await ctx.call(fn.name, args)
        return [
          L(`→ ${fn.name}(${JSON.stringify(args)})`, 'muted'),
          ...res.logs.map((l) => L(`  ${l}`, 'muted')),
          ...JSON.stringify(res.result, null, 2)
            .split('\n')
            .map((t) => L(t, 'ok')),
          L(`done in ${res.ms} ms`, 'muted'),
        ]
      } catch (e) {
        return [L(ctx.errorText(e), 'err')]
      }
    }
    case 'query':
    case 'select': {
      const sql = cmd.name === 'select' ? `select ${cmd.rest}` : cmd.rest
      if (!sql.trim()) return [L('Usage: query select * from <table> limit 5', 'err')]
      try {
        const res = await ctx.query(sql)
        const [head, ...body] = formatTable(res.columns, res.rows)
        return [
          L(head ?? '', 'accent'),
          ...body.map((t) => L(t)),
          L(`${res.rows.length} of ${res.total} rows · ${res.ms} ms`, 'muted'),
        ]
      } catch (e) {
        return [L(ctx.errorText(e), 'err')]
      }
    }
    case 'test': {
      const n = ctx.runTests(cmd.rest.trim())
      return n
        ? [L(`Running ${n} test${n === 1 ? '' : 's'}… see the Tests tab`, 'muted')]
        : [L('No tests match', 'err')]
    }
    case 'problems': {
      if (!ctx.problems.length) return [L('No problems', 'ok')]
      return ctx.problems.map((p) =>
        L(
          `${p.severity === 'error' ? '✕' : p.severity === 'warning' ? '!' : 'i'} ${p.message}  ${p.path}`,
          p.severity === 'error' ? 'err' : 'out',
        ),
      )
    }
    case 'env':
      return [
        L(`app           ${ctx.projectName}`),
        L(`environment   ${ctx.env}`),
        L(`role          ${ctx.role}`),
        L(`databases     ${def.data.connections.length}`),
        L(`version       ${def.version}`),
      ]
    default:
      return [L(`${cmd.name}: command not found. Type help.`, 'err')]
  }
}
