import { customAlphabet } from 'nanoid'

const short = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)

/** Short random id with a readable prefix, e.g. `blk_x81fa2`. Always starts with a letter. */
export function newId(prefix: string): string {
  return `${prefix}_${short()}`
}

export function snake(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** "All work orders" → "allWorkOrders" (block refs, function names). */
export function camel(s: string): string {
  const words = s
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const r = words
    .map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join('')
  return /^\d/.test(r) ? `b${r}` : r || 'block'
}

export function pascal(s: string): string {
  const c = camel(s)
  return c[0]!.toUpperCase() + c.slice(1)
}

/** Make `base` unique against `taken` by appending 2, 3, ... */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const set = new Set(taken)
  if (!set.has(base)) return base
  let i = 2
  while (set.has(`${base}${i}`)) i++
  return `${base}${i}`
}
