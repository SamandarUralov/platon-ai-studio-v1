/** Serialize JSON into display lines that remember the pointer of every key (for hover hints/copy). */
import { elementId } from '@platon/definition'

export interface JsonLine {
  n: number
  depth: number
  key?: string
  /** Pointer of the value on this line (for keys / array items). */
  pointer: string
  /** Value text: a primitive, an opening bracket, or a closing bracket. */
  text: string
  kind: 'string' | 'number' | 'literal' | 'punct'
  comma: boolean
}

const esc = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1')

/** Stops runaway output on huge nodes; the caller shows a "select a child" hint. */
export const MAX_LINES = 4000

export function jsonLines(value: unknown, base = ''): { lines: JsonLine[]; truncated: boolean } {
  const lines: JsonLine[] = []
  let truncated = false
  const push = (l: Omit<JsonLine, 'n'>) => {
    if (lines.length >= MAX_LINES) {
      truncated = true
      return false
    }
    lines.push({ ...l, n: lines.length + 1 })
    return true
  }
  const walk = (v: unknown, ptr: string, depth: number, key: string | undefined, comma: boolean): void => {
    if (truncated) return
    if (Array.isArray(v) || (v && typeof v === 'object')) {
      const arr = Array.isArray(v)
      const entries: [string, unknown, string][] = arr
        ? v.map((x, i) => [String(i), x, `${ptr}/${esc(elementId(x) ?? String(i))}`])
        : Object.entries(v as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .map(([k, x]) => [k, x, `${ptr}/${esc(k)}`])
      if (!entries.length) {
        push({ depth, key, pointer: ptr, text: arr ? '[]' : '{}', kind: 'punct', comma })
        return
      }
      if (!push({ depth, key, pointer: ptr, text: arr ? '[' : '{', kind: 'punct', comma: false })) return
      entries.forEach(([k, x, p], i) => walk(x, p, depth + 1, arr ? undefined : k, i < entries.length - 1))
      push({ depth, pointer: ptr, text: arr ? ']' : '}', kind: 'punct', comma })
      return
    }
    const kind = typeof v === 'string' ? 'string' : typeof v === 'number' ? 'number' : 'literal'
    push({ depth, key, pointer: ptr, text: JSON.stringify(v ?? null), kind, comma })
  }
  walk(value, base, 0, undefined, false)
  return { lines, truncated }
}
