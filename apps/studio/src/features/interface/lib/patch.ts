/** Small helpers that turn "set this nested value" into JSON Patch ops on the definition. */
import { getAt, pointer, type AppDefinition, type PatchOp } from '@platon/definition'

/**
 * Ops that set `base/segs…` to `value`, creating missing parent objects on the way.
 * `undefined` removes the value (no-op when already absent).
 */
export function setOps(doc: AppDefinition, base: string, segs: string[], value: unknown): PatchOp[] {
  const path = base + pointer(...segs)
  const exists = getAt(doc, path) !== undefined
  if (value === undefined) return exists ? [{ op: 'remove', path }] : []
  if (exists) return [{ op: 'replace', path, value }]
  // Find the deepest existing parent and add one nested object from there.
  for (let i = segs.length - 1; i >= 0; i--) {
    const parent = base + pointer(...segs.slice(0, i))
    if (i === 0 || getAt(doc, parent) !== undefined) {
      let v: unknown = value
      for (let j = segs.length - 1; j > i; j--) v = { [segs[j]!]: v }
      return [{ op: 'add', path: base + pointer(...segs.slice(0, i + 1)), value: v }]
    }
  }
  return [{ op: 'add', path, value }]
}

export const pagePath = (pid: string, ...rest: (string | number)[]) =>
  pointer('interface', 'pages', pid, ...rest)
export const blockPath = (pid: string, bid: string, ...rest: (string | number)[]) =>
  pagePath(pid, 'blocks', bid, ...rest)
export const scriptPath = (pid: string) => pagePath(pid, 'script')
