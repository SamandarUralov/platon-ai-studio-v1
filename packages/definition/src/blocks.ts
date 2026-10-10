/** Block layout helpers. Blocks with the same `row` sit side by side, in array order. */
import type { Block, Page } from './generated/app-definition'

export function toRows(blocks: Block[]): Block[][] {
  const rows: Block[][] = []
  let current: number | null = null
  for (const b of blocks) {
    if (current === b.row && rows.length) rows[rows.length - 1]!.push(b)
    else rows.push([b])
    current = b.row
  }
  return rows
}

/** Flatten rows back into blocks with consecutive row numbers. */
export function fromRows(rows: Block[][]): Block[] {
  return rows.filter((r) => r.length).flatMap((r, i) => r.map((b) => (b.row === i ? b : { ...b, row: i })))
}

export type DropSide = 'left' | 'right' | 'before' | 'after'

/** Place `block` relative to `targetId`; when no target, append as a new row. */
export function placeBlock(
  blocks: Block[],
  block: Block,
  targetId?: string | null,
  side: DropSide = 'after',
): Block[] {
  const rows = toRows(blocks.filter((b) => b.id !== block.id))
  if (!targetId) return fromRows([...rows, [block]])
  const r = rows.findIndex((row) => row.some((b) => b.id === targetId))
  if (r < 0) return fromRows([...rows, [block]])
  const row = rows[r]!
  const c = row.findIndex((b) => b.id === targetId)
  if (side === 'left') row.splice(c, 0, block)
  else if (side === 'right') row.splice(c + 1, 0, block)
  else rows.splice(side === 'before' ? r : r + 1, 0, [block])
  return fromRows(rows)
}

export function blockRefs(page: Page): Set<string> {
  return new Set(page.blocks.map((b) => b.ref))
}

/** Pages as a tree using `parent`. */
export interface PageNode {
  id: string
  page: Page
  children: PageNode[]
}

export function pageTree(pages: Page[]): PageNode[] {
  const nodes = new Map(pages.map((p) => [p.id, { id: p.id, page: p, children: [] as PageNode[] }]))
  const roots: PageNode[] = []
  for (const p of pages) {
    const n = nodes.get(p.id)!
    const parent = p.parent ? nodes.get(p.parent) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}

export function pageAncestors(pages: Page[], id: string): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const out: Page[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur?.parent && !seen.has(cur.parent)) {
    seen.add(cur.parent)
    cur = byId.get(cur.parent)
    if (cur) out.unshift(cur)
  }
  return out
}
