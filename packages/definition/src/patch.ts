/**
 * Id-aware JSON Patch (RFC 6902 shape) for the app definition.
 *
 * Pointer segments that land on an array are matched against the element's id first
 * (`id`, then `key`, then `name`), so `/logic/apis/post_work_orders/access/type` stays valid
 * when other people reorder or insert items. A numeric segment or `-` is a position, used by
 * `add`/`move` to place an element. Ids in the definition always start with a letter,
 * so the two never collide.
 *
 * Updates are structural-sharing (copy along the path), which keeps Vue reactivity and undo cheap.
 */
import type { PatchOp } from './generated/change'

export type { PatchOp }

export class PatchError extends Error {
  constructor(
    message: string,
    readonly op: PatchOp,
  ) {
    super(message)
    this.name = 'PatchError'
  }
}

type Json = unknown
type Container = Record<string, unknown> | unknown[]

export function escapeSegment(s: string): string {
  return s.replace(/~/g, '~0').replace(/\//g, '~1')
}

export function parsePointer(path: string): string[] {
  if (path === '') return []
  if (!path.startsWith('/')) throw new Error(`Invalid pointer "${path}"`)
  return path
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

export function pointer(...segments: (string | number)[]): string {
  return segments.map((s) => '/' + escapeSegment(String(s))).join('')
}

/** The identity used to address an array element. */
export function elementId(el: unknown): string | undefined {
  if (!el || typeof el !== 'object') return undefined
  const o = el as Record<string, unknown>
  const v = o.id ?? o.key ?? o.name
  return typeof v === 'string' ? v : undefined
}

const isIndex = (seg: string) => /^(0|[1-9]\d*)$/.test(seg)

function indexIn(arr: unknown[], seg: string): number {
  if (isIndex(seg)) return Number(seg)
  return arr.findIndex((el) => elementId(el) === seg)
}

function child(node: Json, seg: string): Json {
  if (Array.isArray(node)) {
    const i = indexIn(node, seg)
    return i < 0 ? undefined : node[i]
  }
  if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg]
  return undefined
}

export function getAt<T = unknown>(doc: Json, path: string): T | undefined {
  let node = doc
  for (const seg of parsePointer(path)) {
    node = child(node, seg)
    if (node === undefined) return undefined
  }
  return node as T
}

export function hasAt(doc: Json, path: string): boolean {
  return getAt(doc, path) !== undefined
}

function shallowCopy(c: Container): Container {
  return Array.isArray(c) ? c.slice() : { ...c }
}

/** Copy-on-write update of the parent container at `segs[0..-1]`. */
function updateParent(
  doc: Json,
  segs: string[],
  op: PatchOp,
  fn: (parent: Container, last: string) => void,
): Json {
  if (segs.length === 0) throw new PatchError('Cannot operate on the document root', op)
  const walk = (node: Json, depth: number): Json => {
    if (!node || typeof node !== 'object') throw new PatchError(`Path not found: ${op.path}`, op)
    const copy = shallowCopy(node as Container)
    if (depth === segs.length - 1) {
      fn(copy, segs[depth]!)
      return copy
    }
    const seg = segs[depth]!
    if (Array.isArray(copy)) {
      const i = indexIn(copy, seg)
      if (i < 0) throw new PatchError(`Path not found: ${op.path}`, op)
      copy[i] = walk(copy[i], depth + 1)
    } else {
      if (!(seg in copy)) throw new PatchError(`Path not found: ${op.path}`, op)
      copy[seg] = walk(copy[seg], depth + 1)
    }
    return copy
  }
  return walk(doc, 0)
}

function addInto(parent: Container, last: string, value: unknown, op: PatchOp) {
  if (Array.isArray(parent)) {
    if (last === '-') parent.push(value)
    else if (isIndex(last)) {
      const i = Number(last)
      if (i > parent.length) throw new PatchError(`Index out of range: ${op.path}`, op)
      parent.splice(i, 0, value)
    } else {
      // Addressing a new element by id: append, but refuse duplicates.
      if (parent.some((el) => elementId(el) === last)) throw new PatchError(`Duplicate id "${last}"`, op)
      parent.push(value)
    }
  } else parent[last] = value
}

function removeFrom(parent: Container, last: string, op: PatchOp): unknown {
  if (Array.isArray(parent)) {
    const i = indexIn(parent, last)
    if (i < 0) throw new PatchError(`Path not found: ${op.path}`, op)
    return parent.splice(i, 1)[0]
  }
  if (!(last in parent)) throw new PatchError(`Path not found: ${op.path}`, op)
  const v = parent[last]
  delete parent[last]
  return v
}

/**
 * Definition values are plain JSON by contract. JSON cloning (unlike structuredClone) also accepts
 * Vue reactive proxies, which callers may pass straight from component state.
 */
export function cloneJson<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function applyOp<T>(doc: T, op: PatchOp): T {
  const segs = parsePointer(op.path)
  switch (op.op) {
    case 'add':
      return updateParent(doc, segs, op, (p, last) => addInto(p, last, cloneJson(op.value), op)) as T
    case 'remove':
      return updateParent(doc, segs, op, (p, last) => void removeFrom(p, last, op)) as T
    case 'replace':
      return updateParent(doc, segs, op, (p, last) => {
        if (Array.isArray(p)) {
          const i = indexIn(p, last)
          if (i < 0) throw new PatchError(`Path not found: ${op.path}`, op)
          p[i] = cloneJson(op.value)
        } else p[last] = cloneJson(op.value)
      }) as T
    case 'move':
    case 'copy': {
      if (!op.from) throw new PatchError(`${op.op} needs "from"`, op)
      const value = getAt(doc, op.from)
      if (value === undefined) throw new PatchError(`Path not found: ${op.from}`, op)
      const base = op.op === 'move' ? applyOp(doc, { op: 'remove', path: op.from }) : doc
      return applyOp(base, { op: 'add', path: op.path, value })
    }
    case 'test':
      if (!deepEqual(getAt(doc, op.path), op.value)) throw new PatchError(`Test failed at ${op.path}`, op)
      return doc
  }
}

export function applyPatch<T>(doc: T, ops: readonly PatchOp[]): T {
  return ops.reduce<T>((d, op) => applyOp(d, op), doc)
}

/** Position of the element addressed by `path` inside its parent array, or -1. */
function arrayPosition(doc: Json, path: string): { parentPath: string; index: number } | null {
  const segs = parsePointer(path)
  const parentPath = segs
    .slice(0, -1)
    .map((s) => '/' + escapeSegment(s))
    .join('')
  const parent = getAt(doc, parentPath)
  if (!Array.isArray(parent)) return null
  return { parentPath, index: indexIn(parent, segs[segs.length - 1]!) }
}

/**
 * Ops that undo `ops` when applied to the document *after* `ops`.
 * Computed against the document *before* `ops`.
 */
export function invertPatch(before: Json, ops: readonly PatchOp[]): PatchOp[] {
  const inverse: PatchOp[] = []
  let doc = before
  for (const op of ops) {
    switch (op.op) {
      case 'add': {
        const segs = parsePointer(op.path)
        const last = segs[segs.length - 1]!
        const parent = getAt(doc, pointer(...segs.slice(0, -1)))
        if (Array.isArray(parent)) {
          const id = elementId(op.value)
          const idx = last === '-' || !isIndex(last) ? parent.length : Number(last)
          inverse.unshift({ op: 'remove', path: pointer(...segs.slice(0, -1), id ?? idx) })
        } else {
          const old = getAt(doc, op.path)
          inverse.unshift(
            old === undefined
              ? { op: 'remove', path: op.path }
              : { op: 'replace', path: op.path, value: old },
          )
        }
        break
      }
      case 'remove': {
        const old = getAt(doc, op.path)
        const pos = arrayPosition(doc, op.path)
        inverse.unshift(
          pos
            ? { op: 'add', path: `${pos.parentPath}/${pos.index}`, value: old }
            : { op: 'add', path: op.path, value: old },
        )
        break
      }
      case 'replace':
        inverse.unshift({ op: 'replace', path: op.path, value: getAt(doc, op.path) })
        break
      case 'move': {
        const pos = op.from ? arrayPosition(doc, op.from) : null
        const value = op.from ? getAt(doc, op.from) : undefined
        const id = elementId(value)
        const segs = parsePointer(op.path)
        const newPath = id !== undefined && pos ? pointer(...segs.slice(0, -1), id) : op.path
        inverse.unshift({
          op: 'move',
          from: newPath,
          path: pos ? `${pos.parentPath}/${pos.index}` : op.from!,
        })
        break
      }
      case 'copy': {
        const segs = parsePointer(op.path)
        const value = op.from ? getAt(doc, op.from) : undefined
        const id = elementId(value)
        inverse.unshift({
          op: 'remove',
          path: id !== undefined ? pointer(...segs.slice(0, -1), id) : op.path,
        })
        break
      }
      case 'test':
        break
    }
    doc = applyOp(doc, op)
  }
  return inverse
}
