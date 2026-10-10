/**
 * Page-script helpers for Code mode: the default file, a light outline parser, handler stubs and the
 * `ctx` typings fed to Monaco. Parsing is a small scanner (strings, comments, braces) — the server
 * and the Preview sandbox are the real judges of the code.
 */
import {
  BLOCK_API,
  BLOCK_API_COMMON,
  BLOCKS,
  EVENT_ARG,
  LIFECYCLE_PHASES,
  PAGE_CTX,
  type AppDefinition,
  type Page,
  type TypedField,
} from '@platon/definition'

export const scriptFile = (page: Page) => page.script?.file ?? `pages/${page.id}.page.js`

export function defaultScript(page: Page): string {
  const tables = page.blocks.filter((b) => b.type === 'table')
  const header = page.blocks.find(
    (b) => b.type === 'header' && (b.props as { buttonLabel?: string }).buttonLabel,
  )
  const L = [
    `// ${page.name} · page logic`,
    '// Runs in the browser. Server work goes through ctx.call().',
    'export default definePage({',
    '  state: { selected: null },',
    '',
    '  async onLoad(ctx) {',
    ...tables.map((t) => `    await ctx.blocks.${t.ref}.load()`),
    `    ctx.log('${page.name.replace(/'/g, "\\'")} ready')`,
    '  },',
    '',
    '  on: {',
  ]
  for (const t of tables)
    L.push(`    '${t.ref}.rowClick': (ctx, row) => {`, '      ctx.state.selected = row', '    },')
  if (header)
    L.push(
      `    '${header.ref}.buttonClick': (ctx) => {`,
      `      ctx.navigate('${page.route.replace(/\/$/, '')}/new')`,
      '    },',
    )
  L.push('  },', '})', '')
  return L.join('\n')
}

export type OutlineKind = 'state' | 'computed' | 'hook' | 'handler'
export interface OutlineItem {
  label: string
  kind: OutlineKind
  line: number
}

const IDENT = /(?:async\s+)?([A-Za-z_$][\w$]*)(?:\s*(:|\())?/y
const HOOKS = new Set(['onLoad', ...LIFECYCLE_PHASES.flatMap((p) => p.hooks.map((h) => h.name))])

/**
 * Members of `definePage({ … })`: keys of state / computed / on, and hook methods.
 * Works on partial or broken code; whatever can't be read is skipped.
 */
export function parseOutline(src: string): OutlineItem[] {
  const out: OutlineItem[] = []
  const start = src.indexOf('definePage(')
  if (start < 0) return out
  let i = src.indexOf('{', start)
  if (i < 0) return out
  let depth = 0
  let line = src.slice(0, i).split('\n').length
  /** Section (state / computed / on) open at depth 2, with the depth it started. */
  let section: string | null = null
  let expectKey = true
  for (; i < src.length; i++) {
    const ch = src[i]!
    if (ch === '\n') {
      line++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i)
      i = (e < 0 ? src.length : e) - 1
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      const end = e < 0 ? src.length : e + 1
      line += (src.slice(i, end).match(/\n/g) ?? []).length
      i = end
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\') j++
        else if (src[j] === '\n') line++
        j++
      }
      const text = src.slice(i + 1, j)
      if (expectKey && /^\s*:/.test(src.slice(j + 1, j + 40)) && depth === 2 && section) {
        out.push({ label: text, kind: section === 'on' ? 'handler' : (section as OutlineKind), line })
      }
      i = j
      expectKey = false
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++
      expectKey = ch === '{'
      continue
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth--
      if (depth === 1) section = null
      if (depth <= 0) break
      expectKey = false
      continue
    }
    if (ch === ',') {
      expectKey = true
      continue
    }
    if (/[A-Za-z_$]/.test(ch)) {
      IDENT.lastIndex = i
      const m = IDENT.exec(src)
      if (!m) continue
      const name = m[1]!
      if (expectKey && depth === 1 && m[2]) {
        if (name === 'state' || name === 'computed' || name === 'on') section = name
        else if (HOOKS.has(name) || m[2] === '(') out.push({ label: `${name}()`, kind: 'hook', line })
      } else if (expectKey && depth === 2 && section && m[2]) {
        const kind: OutlineKind = section === 'on' ? 'handler' : section === 'computed' ? 'computed' : 'state'
        out.push({ label: name, kind, line })
      }
      i += m[0].length - 1 - (m[2] ? 1 : 0)
      expectKey = false
    }
  }
  return out
}

/** Find or add a handler for `ref.event`. Returns the new source and the line to put the cursor on. */
export function ensureHandler(
  src: string,
  ref: string,
  event: string,
): { source: string; line: number; added: boolean } {
  const key = `${ref}.${event}`
  const lines = src.split('\n')
  const at = lines.findIndex((l) => l.includes(`'${key}'`) || l.includes(`"${key}"`))
  if (at >= 0) return { source: src, line: at + 1, added: false }
  const arg = EVENT_ARG[event] ?? 'value'
  const stub = [`    '${key}': (ctx, ${arg}) => {`, `      ctx.log('${key}', ${arg})`, '    },']
  const on = lines.findIndex((l) => /^\s*on\s*:\s*\{/.test(l))
  if (on >= 0) {
    lines.splice(on + 1, 0, ...stub)
    return { source: lines.join('\n'), line: on + 3, added: true }
  }
  let end = -1
  for (let i = lines.length - 1; i >= 0; i--)
    if (/^\s*\}\s*\)\s*;?\s*$/.test(lines[i]!)) {
      end = i
      break
    }
  if (end < 0) return { source: src, line: 1, added: false }
  const prev = end - 1
  if (prev >= 0 && lines[prev]!.trim() && !/[,{]\s*$/.test(lines[prev]!)) lines[prev] = `${lines[prev]},`
  lines.splice(end, 0, '', '  on: {', ...stub, '  },')
  return { source: lines.join('\n'), line: end + 4, added: true }
}

// ── typings ─────────────────────────────────────────────────────────────────────────

const ident = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s))

function tsType(t: string, fields?: TypedField[]): string {
  const arr = /^array<(.+)>$/.exec(t)
  if (arr) return `${tsType(arr[1]!)}[]`
  if (/^row<.+>$/.test(t)) return 'Row'
  switch (t) {
    case 'string':
    case 'date':
    case 'datetime':
    case 'enum':
    case 'file':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'object':
      return fields?.length
        ? `{ ${fields.map((f) => `${ident(f.name)}${f.req ? '' : '?'}: ${tsType(f.type, f.fields)}`).join('; ')} }`
        : 'Record<string, unknown>'
    case 'any':
      return 'unknown'
    default:
      // A table id used as a type, e.g. array<work_orders>.
      return 'Row'
  }
}

const PARAM_TYPES: Record<string, string> = {
  params: 'params?: Record<string, unknown>',
  name: 'name: string',
  value: 'value: unknown',
}

function member([sig, type, doc]: [string, string, string]): string {
  const m = /^(\w+)\((.*)\)$/.exec(sig)
  const t = type === 'Field' ? 'BlockField' : type
  if (m) {
    const ps = m[2]!
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    return `  /** ${doc} */\n  ${m[1]}(${ps.map((p) => PARAM_TYPES[p] ?? `${p}: unknown`).join(', ')}): ${t}`
  }
  return `  /** ${doc} */\n  ${sig}: ${t}`
}

/** `declare` file that gives page code autocomplete for ctx.blocks, ctx.call and handler names. */
export function ctxTypings(page: Page, def: AppDefinition): string {
  const blockTypes = page.blocks.map((b) => {
    const api = [...BLOCK_API_COMMON, ...(BLOCK_API[b.type] ?? [])]
    return `/** ${BLOCKS[b.type].label}${b.title ? ` · ${b.title}` : ''} */\ninterface Block_${b.ref} {\n${api.map(member).join('\n')}\n}`
  })
  const calls = def.logic.functions.map(
    (f) =>
      `  /** ${f.description ?? `Logic function ${f.name}`} */\n  call(name: ${JSON.stringify(f.name)}${f.params.map((p) => `, ${ident(p.name)}${p.req ? '' : '?'}: ${tsType(p.type, p.fields)}`).join('')}): Promise<${tsType(f.returns.type, f.returns.fields)}>`,
  )
  const events = page.blocks.flatMap((b) =>
    BLOCKS[b.type].events.map(
      (e) =>
        `  ${JSON.stringify(`${b.ref}.${e}`)}?: (ctx: Ctx, ${EVENT_ARG[e] ?? 'value'}: ${e === 'rowClick' ? 'Row' : e === 'select' || e === 'load' ? 'Row[]' : 'any'}) => unknown`,
    ),
  )
  const hooks = LIFECYCLE_PHASES.flatMap((p) => p.hooks).map(
    (h) => `  /** ${h.hint} */\n  ${h.name}?(ctx: Ctx): unknown`,
  )
  const doc = Object.fromEntries(PAGE_CTX.map(([k, , d]) => [k, d]))
  return `// Generated by Platon Studio for ${page.id}. Do not edit.
interface Row { id: string; [field: string]: any }
interface BlockField { name: string; value: unknown; visible: boolean; disabled: boolean }
${blockTypes.join('\n')}
interface Blocks {
${page.blocks.map((b) => `  ${ident(b.ref)}: Block_${b.ref}`).join('\n')}
}
interface Ctx {
  /** ${doc.blocks} */
  blocks: Blocks
  /** ${doc.state} */
  state: Record<string, any>
  /** Values from \`computed\` */
  computed: Record<string, any>
${calls.join('\n')}
  call(name: string, ...args: unknown[]): Promise<any>
  /** ${doc.navigate} */
  navigate(to: string): void
  /** ${doc.toast} */
  toast(text: string, tone?: 'info' | 'ok' | 'warn' | 'danger'): void
  /** ${doc.confirm} */
  confirm(text: string): Promise<boolean>
  /** ${doc.route} */
  route: { path: string; params: Record<string, string>; query: Record<string, string> }
  /** ${doc.user} */
  user: { name: string; role: string }
  /** ${doc.log} */
  log(...args: unknown[]): void
  /** Today's date as YYYY-MM-DD */
  today(): string
}
interface PageDefinition {
  state?: Record<string, unknown>
  computed?: Record<string, (ctx: Ctx) => unknown>
  /** Runs once when the page opens, after onBeforeRender. */
  onLoad?(ctx: Ctx): unknown
${hooks.join('\n')}
  on?: {
${events.join('\n')}
  }
}
declare function definePage(page: PageDefinition): PageDefinition
/** Available inside lifecycle handlers. */
declare const ctx: Ctx
`
}

/** Function signature for the "Available logic" list, e.g. "(order_id: string, trade: string)". */
export function signature(f: { params: TypedField[] }): string {
  return `(${f.params.map((p) => `${p.name}${p.req ? '' : '?'}: ${p.type}`).join(', ')})`
}
