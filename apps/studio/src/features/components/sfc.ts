/**
 * Pure helpers for custom component single-file components: keeping `defineProps({ … })` in the
 * `.vue` source in step with the Properties form, reading props/events back from code, prop-name
 * rules and the metadata JSON shared with the Constructor (docs/IMPLEMENTATION_PLAN.md F14).
 * Code is only scanned as text — never evaluated.
 */
import type { ComponentMeta } from '@platon/bridge'
import type { ComponentProp, ComponentPropType, CustomComponent } from '@platon/definition'

export type PropInput = ComponentProp['input']

export const PROP_TYPES: ComponentPropType[] = ['String', 'Number', 'Boolean', 'Array', 'Object']

/** Inputs a page builder can get for each prop type; the first one is the default. */
export const INPUTS_BY_TYPE: Record<ComponentPropType, PropInput[]> = {
  String: ['text', 'textarea', 'select', 'color'],
  Number: ['number', 'slider'],
  Boolean: ['toggle'],
  Array: ['source', 'list', 'json'],
  Object: ['json', 'record'],
}

/** Names Vue treats specially on any component. */
export const RESERVED_PROP_NAMES = ['class', 'style', 'key', 'ref', 'is', 'slot']

export const kebab = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
export const snakeName = (n: string) => kebab(n).replace(/-/g, '_')
/** `component:job_timeline` → `job_timeline` (the part used in Studio URLs). */
export const shortId = (id: string) => id.replace(/^component:/, '')
export const fullId = (short: string) => (short.startsWith('component:') ? short : `component:${short}`)
/** "showProgress" → "Show progress" */
export const labelFromName = (n: string) =>
  n
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^./, (x) => x.toUpperCase())

// ── Names ──────────────────────────────────────────────────────────────────────────────────────

export type PropNameError = 'required' | 'camel' | 'reserved' | 'duplicate'

/** Why `name` can't be used for a prop, or null. `others` are the names of the other props. */
export function propNameError(name: string, others: readonly string[]): PropNameError | null {
  if (!name) return 'required'
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) return 'camel'
  if (RESERVED_PROP_NAMES.includes(name)) return 'reserved'
  if (others.includes(name)) return 'duplicate'
  return null
}

export type ComponentNameError = 'required' | 'pascal' | 'duplicate'

export function componentNameError(name: string, others: readonly string[]): ComponentNameError | null {
  if (!name) return 'required'
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return 'pascal'
  if (others.includes(name)) return 'duplicate'
  return null
}

// ── Writing defineProps ────────────────────────────────────────────────────────────────────────

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** JS source for a prop's default, mirroring how Vue wants object/array defaults as factories. */
export function defaultJs(p: ComponentProp): string {
  const d = p.default
  const empty = d == null || d === ''
  if (p.type === 'Array')
    return p.input === 'source' || empty
      ? '() => []'
      : `() => ${typeof d === 'string' ? d : JSON.stringify(d)}`
  if (p.type === 'Object')
    return p.input === 'record' || empty
      ? '() => ({})'
      : `() => (${typeof d === 'string' ? d : JSON.stringify(d)})`
  if (p.type === 'Boolean') return d === true || d === 'true' ? 'true' : 'false'
  if (p.type === 'Number') return String(Number(d) || 0)
  return quote(String(d ?? ''))
}

export function propLine(p: ComponentProp): string {
  const req = p.required ? ', required: true' : `, default: ${defaultJs(p)}`
  const opts =
    p.input === 'select' && p.options?.length
      ? `, validator: (v) => [${p.options.map(quote).join(', ')}].includes(v)`
      : ''
  return `  ${p.name}: { type: ${p.type}${req}${opts} },`
}

export function propsBlock(props: readonly ComponentProp[]): string {
  return `const props = defineProps({\n${props.map(propLine).join('\n')}${props.length ? '\n' : ''}})`
}

// ── Scanning code ──────────────────────────────────────────────────────────────────────────────

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

/** Index just past the bracket that closes the one at `start`, skipping strings and comments. */
function matchBracket(code: string, start: number): number {
  const stack: string[] = []
  for (let i = start; i < code.length; i++) {
    const c = code[i]!
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++
      continue
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end < 0 ? code.length : end + 1
      continue
    }
    if (OPEN[c]) stack.push(OPEN[c])
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1
      if (!stack.length) return i + 1
    }
  }
  return -1
}

/** Split at top-level commas (ignoring those inside brackets and strings). */
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      for (; j < s.length && s[j] !== c; j++) if (s[j] === '\\') j++
      cur += s.slice(i, j + 1)
      i = j
      continue
    }
    if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++
      continue
    }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    if (c === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

/** Split `key: value` at the first top-level colon. */
function keyValue(entry: string): [string, string] | null {
  const m = /^(['"]?)([A-Za-z_$][\w$]*)\1\s*:\s*([\s\S]*)$/.exec(entry)
  return m ? [m[2]!, m[3]!.trim()] : null
}

export interface PropsRange {
  /** Start of `const props = defineProps(` (or of `defineProps(` when not assigned). */
  start: number
  /** Index just past the closing `)`. */
  end: number
  /** Text inside `{ … }`. */
  body: string
}

/** Locate the runtime `defineProps({ … })` declaration; null when absent or written as a type. */
export function findPropsBlock(code: string): PropsRange | null {
  const re = /(?:const\s+props\s*=\s*)?defineProps\s*\(\s*\{/g
  const m = re.exec(code)
  if (!m) return null
  const brace = m.index + m[0].length - 1
  const close = matchBracket(code, brace)
  if (close < 0) return null
  const paren = /^\s*\)/.exec(code.slice(close))
  if (!paren) return null
  return { start: m.index, end: close + paren[0].length, body: code.slice(brace + 1, close - 1) }
}

export interface ParsedProp {
  name: string
  type: ComponentPropType
  required: boolean
  /** Literal default when it is a plain string/number/boolean; otherwise the raw JS text. */
  default?: unknown
  defaultRaw?: string
  options?: string[]
}

function literal(raw: string): { value?: unknown; ok: boolean } {
  const s = raw.trim()
  if (/^'(?:[^'\\]|\\.)*'$/.test(s) || /^"(?:[^"\\]|\\.)*"$/.test(s))
    return { ok: true, value: s.slice(1, -1).replace(/\\(.)/g, '$1') }
  if (/^-?\d+(\.\d+)?$/.test(s)) return { ok: true, value: Number(s) }
  if (s === 'true' || s === 'false') return { ok: true, value: s === 'true' }
  return { ok: false }
}

const asType = (t: string | undefined): ComponentPropType => {
  const first = (t ?? '').replace(/^\[/, '').split(',')[0]!.trim()
  return (PROP_TYPES as string[]).includes(first) ? (first as ComponentPropType) : 'String'
}

/** Props declared in code (null when there is no `defineProps({ … })` block). */
export function parseProps(code: string): ParsedProp[] | null {
  const block = findPropsBlock(code)
  if (!block) return null
  const out: ParsedProp[] = []
  for (const entry of splitTop(block.body)) {
    const kv = keyValue(entry)
    if (!kv) continue
    const [name, value] = kv
    if (!value.startsWith('{')) {
      out.push({ name, type: asType(value), required: false })
      continue
    }
    const fields = new Map<string, string>()
    for (const f of splitTop(value.slice(1, value.lastIndexOf('}')))) {
      const fkv = keyValue(f)
      if (fkv) fields.set(fkv[0], fkv[1])
    }
    const p: ParsedProp = {
      name,
      type: asType(fields.get('type')),
      required: fields.get('required') === 'true',
    }
    const def = fields.get('default')
    if (def !== undefined) {
      const lit = literal(def)
      if (lit.ok) p.default = lit.value
      p.defaultRaw = def
    }
    const validator = fields.get('validator')
    const list = validator ? /\[([^\]]*)\]/.exec(validator) : null
    if (list) p.options = [...list[1]!.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2] ?? '')
    out.push(p)
  }
  return out
}

/** Event names from `defineEmits(['a', 'b'])` or the typed `defineEmits<{ a: [...] }>()` forms. */
export function parseEmits(code: string): string[] {
  const arr = /defineEmits\s*\(\s*\[([^\]]*)\]\s*\)/.exec(code)
  if (arr) return [...arr[1]!.matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => (x[1] ?? x[2])!)
  const typed = /defineEmits\s*<\s*\{/.exec(code)
  if (!typed) return []
  const start = typed.index + typed[0].length - 1
  const end = matchBracket(code, start)
  if (end < 0) return []
  const body = code.slice(start + 1, end - 1)
  const names = new Set<string>()
  for (const m of body.matchAll(/\(\s*e\s*:\s*['"]([^'"]+)['"]/g)) names.add(m[1]!)
  for (const part of splitTop(body.replace(/;/g, ','))) {
    const m = /^['"]?([A-Za-z_$][\w$:-]*)['"]?\s*:/.exec(part)
    if (m) names.add(m[1]!)
  }
  return [...names]
}

/**
 * Rewrite the `defineProps({ … })` block from the Properties form. The code is returned unchanged
 * when there is no block to rewrite or a prop name is invalid (writing it would break the file).
 */
export function syncProps(code: string, props: readonly ComponentProp[]): string {
  const block = findPropsBlock(code)
  if (!block) return code
  const names = props.map((p) => p.name)
  if (
    props.some((p, i) =>
      propNameError(
        p.name,
        names.filter((_, j) => j !== i),
      ),
    )
  )
    return code
  return code.slice(0, block.start) + propsBlock(props) + code.slice(block.end)
}

const sameDefault = (p: ComponentProp, c: ParsedProp) => {
  if (p.required) return true
  if (c.defaultRaw === undefined) return p.default == null || p.default === ''
  if (p.type === 'Array' || p.type === 'Object') return c.defaultRaw !== undefined
  return c.default === typedDefault(p)
}

export type SyncState =
  { kind: 'ok' } | { kind: 'missing' } | { kind: 'codeOnly'; names: string[] } | { kind: 'differs' }

/** Compare code with the Properties form by meaning (formatting differences are fine). */
export function syncState(code: string, props: readonly ComponentProp[]): SyncState {
  const parsed = parseProps(code)
  if (!parsed) return { kind: 'missing' }
  const names = props.map((p) => p.name)
  const codeOnly = parsed.filter((c) => !names.includes(c.name)).map((c) => c.name)
  if (codeOnly.length) return { kind: 'codeOnly', names: codeOnly }
  if (parsed.length !== props.length) return { kind: 'differs' }
  for (const p of props) {
    const c = parsed.find((x) => x.name === p.name)!
    if (c.type !== p.type || c.required !== p.required || !sameDefault(p, c)) return { kind: 'differs' }
    if (p.input === 'select' && (p.options ?? []).join('|') !== (c.options ?? []).join('|'))
      return { kind: 'differs' }
  }
  return { kind: 'ok' }
}

/** Turn props found only in code into Properties-form entries. */
export function propsFromCode(parsed: readonly ParsedProp[]): ComponentProp[] {
  return parsed.map((c) => {
    const input = c.options?.length && c.type === 'String' ? 'select' : INPUTS_BY_TYPE[c.type][0]!
    const p: ComponentProp = {
      name: c.name,
      label: labelFromName(c.name),
      type: c.type,
      input,
      required: c.required,
    }
    if (c.default !== undefined) p.default = c.default
    if (c.options?.length) p.options = c.options
    return p
  })
}

/** Value shown for a prop: the sample when set, else its default. */
export function valueOf(p: ComponentProp, values: Record<string, unknown> | undefined): unknown {
  const v = values?.[p.name]
  if (v !== undefined && v !== '') return v
  if (p.input === 'toggle') return p.default === true || p.default === 'true'
  if (p.input === 'select') return p.options?.includes(String(p.default)) ? p.default : (p.options?.[0] ?? '')
  return p.default ?? ''
}

// ── Files and metadata ─────────────────────────────────────────────────────────────────────────

export const componentPath = (folder: 'components' | 'pages', name: string) => `src/${folder}/${name}.vue`

/** Starter file for "Write Vue code". */
export function scaffoldSource(name: string): string {
  const k = kebab(name)
  return [
    '<template>',
    `  <div class="${k}">`,
    '    <!-- Your markup. Props are available by name. -->',
    '  </div>',
    '</template>',
    '',
    '<script setup>',
    'const props = defineProps({',
    '})',
    'const emit = defineEmits([])',
    '</script>',
    '',
    '<style scoped>',
    `.${k} {`,
    '}',
    '</style>',
    '',
  ].join('\n')
}

/** Typed default for the metadata (primitives only; data-bound defaults stay out of the contract). */
function typedDefault(p: ComponentProp): unknown {
  if (p.required) return undefined
  if (p.type === 'Number') return Number(p.default) || 0
  if (p.type === 'Boolean') return p.default === true || p.default === 'true'
  if (p.type === 'String') return String(p.default ?? '')
  return undefined
}

/** `meta.json` — what the runtime and the Constructor read about a component. */
export function buildMeta(c: CustomComponent, events: readonly string[] = c.events): ComponentMeta {
  return {
    id: c.id,
    kind: 'vue-component',
    name: c.name,
    file: c.file,
    source: c.source.type === 'ai' ? { type: 'ai', prompt: c.source.prompt ?? '' } : { type: 'code' },
    props: c.props.map((p) => {
      const d = typedDefault(p)
      return {
        name: p.name,
        label: p.label || p.name,
        type: p.type,
        input: p.input,
        required: !!p.required,
        ...(d !== undefined ? { default: d } : {}),
        ...(p.input === 'select' ? { options: p.options ?? [] } : {}),
      }
    }),
    events: [...events],
  }
}
