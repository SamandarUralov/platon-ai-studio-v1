/**
 * Block layout helpers. Blocks with the same `row` sit side by side, in array order.
 * Containers (grid, columns, card, tabs, ...) hold blocks in cells: a child points at its container
 * with `parent` + `slot`, so `page.blocks` stays one flat list and id-based patch paths keep working.
 */
import type { Block, BlockType, Page } from './generated/app-definition'

/** Where a block sits: the page itself (no parent) or one cell of a container. */
export interface Cell {
  parent?: string
  slot?: number
}

export const CONTAINER_TYPES = new Set<BlockType>([
  'container',
  'section',
  'grid',
  'columns',
  'tabs',
  'accordion',
])
export const isContainer = (type: BlockType): boolean => CONTAINER_TYPES.has(type)

/** Comma list or string[] prop → trimmed non-empty strings. */
export function listProp(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : []
  return raw.map((s) => s.trim()).filter(Boolean)
}

export const COLUMN_RATIOS = ['1:1', '2:1', '1:2', '1:1:1', '1:2:1', '1:1:1:1'] as const

/** Column weights of a `columns` block, e.g. "1:2:1" → [1, 2, 1]. */
export function columnWeights(ratio: unknown): number[] {
  const w = String(ratio ?? '1:1')
    .split(':')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
  return w.length ? w.slice(0, 6) : [1, 1]
}

const clampInt = (v: unknown, d: number, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

/** Cell labels of a container block (empty for other blocks). */
export function slotLabels(block: Pick<Block, 'type' | 'props'>): string[] {
  const p = block.props as Record<string, unknown>
  switch (block.type) {
    case 'container':
    case 'section':
      return ['Content']
    case 'grid': {
      const n = clampInt(p.columns, 2, 1, 6) * clampInt(p.rows, 1, 1, 6)
      return Array.from({ length: n }, (_, i) => `Cell ${i + 1}`)
    }
    case 'columns':
      return columnWeights(p.ratio).map((_, i) => `Column ${i + 1}`)
    case 'tabs': {
      const l = listProp(p.tabs)
      return l.length ? l : ['Details', 'Parts', 'Photos']
    }
    case 'accordion': {
      const l = listProp(p.panels)
      return l.length ? l : ['Section 1', 'Section 2', 'Section 3']
    }
    default:
      return []
  }
}

const inCell = (b: Block, c: Cell) =>
  (b.parent ?? null) === (c.parent ?? null) && (b.slot ?? 0) === (c.slot ?? 0)

/**
 * Blocks in one cell, in array order. Children whose slot no longer exists (the container lost a
 * column or tab) show in its last cell so nothing silently disappears.
 */
export function cellBlocks(blocks: Block[], parent?: string, slot = 0, slotCount?: number): Block[] {
  if (!parent) return blocks.filter((b) => !b.parent)
  const last = slotCount !== undefined && slot === slotCount - 1
  return blocks.filter(
    (b) => b.parent === parent && ((b.slot ?? 0) === slot || (last && (b.slot ?? 0) > slot)),
  )
}

export const cellOf = (b: Block): Cell => (b.parent ? { parent: b.parent, slot: b.slot ?? 0 } : {})

/** `block` moved into `cell` (parent/slot set, or removed for the page level). */
export function withCell(block: Block, cell: Cell): Block {
  const { parent: _p, slot: _s, ...rest } = block
  return cell.parent ? { ...rest, parent: cell.parent, slot: cell.slot ?? 0 } : rest
}

/** Ids of every block nested (at any depth) inside `id`. */
export function descendantIds(blocks: Block[], id: string): Set<string> {
  const out = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const b of blocks)
      if (b.parent === cur && !out.has(b.id)) {
        out.add(b.id)
        queue.push(b.id)
      }
  }
  return out
}

/** Containers `id` sits in, outermost first. */
export function ancestorIds(blocks: Block[], id: string): string[] {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const out: string[] = []
  let cur = byId.get(id)?.parent
  while (cur && !out.includes(cur)) {
    out.unshift(cur)
    cur = byId.get(cur)?.parent
  }
  return out
}

/** A block can't be dropped into itself or anything nested inside it. */
export function canPlaceIn(blocks: Block[], blockId: string, cell: Cell): boolean {
  if (!cell.parent) return true
  return cell.parent !== blockId && !descendantIds(blocks, blockId).has(cell.parent)
}

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

/** Blocks in one row share a 12-column grid: 12 divides into halves, thirds, quarters and sixths. */
export const GRID_COLUMNS = 12

const clampSpan = (v: unknown) => Math.min(GRID_COLUMNS, Math.max(1, Math.round(Number(v))))
const hasSpan = (b: Block) => Number.isFinite(Number(b.span)) && b.span !== undefined

/**
 * Columns each block of a row takes. Blocks with a `span` keep it; the others share what is left.
 * When the explicit spans leave no room (or overflow), the row falls back to equal widths, so a
 * block dropped into a full row squeezes in instead of wrapping, and the stored spans come back
 * once it leaves.
 */
export function rowSpans(row: Pick<Block, 'span'>[]): number[] {
  const n = row.length
  if (!n) return []
  const fixed = row.map((b) => (hasSpan(b as Block) ? clampSpan(b.span) : null))
  const used = fixed.reduce<number>((a, s) => a + (s ?? 0), 0)
  const autos = fixed.filter((s) => s === null).length
  const left = GRID_COLUMNS - used
  if (used > GRID_COLUMNS || (autos > 0 && left < autos) || (autos === 0 && used < 1)) return equalSpans(n)
  let i = 0
  return fixed.map((s) => {
    if (s !== null) return s
    const share = Math.floor(left / autos) + (i < left % autos ? 1 : 0)
    i++
    return share
  })
}

function equalSpans(n: number): number[] {
  const base = Math.max(1, Math.floor(GRID_COLUMNS / n))
  const extra = n <= GRID_COLUMNS ? GRID_COLUMNS - base * n : 0
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * Spans after giving block `id` a width of `span` columns in its row. The span is clamped so every
 * other block keeps at least one column; when the others' fixed spans no longer fit, they become
 * auto and share the rest. Returns the new `span` per block id (undefined = auto).
 */
export function resizeInRow(row: Block[], id: string, span: number): Map<string, number | undefined> {
  const out = new Map<string, number | undefined>()
  const n = row.length
  const s = Math.min(GRID_COLUMNS - (n - 1), clampSpan(span))
  const others = row.filter((b) => b.id !== id)
  const fixedOthers = others.reduce((a, b) => a + (hasSpan(b) ? clampSpan(b.span) : 1), 0)
  const fits = fixedOthers + s <= GRID_COLUMNS
  for (const b of row) {
    if (b.id === id) out.set(b.id, s >= GRID_COLUMNS ? undefined : s)
    else out.set(b.id, fits && hasSpan(b) ? clampSpan(b.span) : undefined)
  }
  return out
}

/** `blocks` with the spans from `resizeInRow` applied (undefined removes the key). */
export function applySpans(blocks: Block[], spans: Map<string, number | undefined>): Block[] {
  return blocks.map((b) => {
    if (!spans.has(b.id)) return b
    const next = spans.get(b.id)
    if (next === b.span) return b
    const { span: _s, ...rest } = b
    return next === undefined ? rest : { ...rest, span: next }
  })
}

function withoutSpan(b: Block): Block {
  if (b.span === undefined) return b
  const { span: _s, ...rest } = b
  return rest
}

/** Columns block `id` takes in its row right now (12 when it is not on the page). */
export function spanOf(blocks: Block[], id: string): number {
  const row = rowOf(blocks, id)
  return rowSpans(row)[row.findIndex((b) => b.id === id)] ?? GRID_COLUMNS
}

/** The row (in its cell) that block `id` sits in. */
export function rowOf(blocks: Block[], id: string): Block[] {
  const b = blocks.find((x) => x.id === id)
  if (!b) return []
  const c = cellOf(b)
  const rows = toRows(blocks.filter((x) => inCell(x, c)))
  return rows.find((r) => r.some((x) => x.id === id)) ?? []
}

/**
 * Place `block` relative to `targetId` (it joins the target's cell); with no target it becomes the
 * last row of `cell` (the page when omitted). Other cells keep their order and row numbers.
 */
export function placeBlock(
  blocks: Block[],
  block: Block,
  targetId?: string | null,
  side: DropSide = 'after',
  cell: Cell = {},
): Block[] {
  const rest = blocks.filter((b) => b.id !== block.id)
  const target = targetId ? rest.find((b) => b.id === targetId) : undefined
  const at = target ? cellOf(target) : cell
  const from = blocks.find((b) => b.id === block.id)
  // A width only means something next to the blocks it was sized against: a block reordered inside
  // its row keeps its span, one that lands in another row takes an auto share there.
  const sameRow =
    !!from && !!target && (side === 'left' || side === 'right') && inCell(from, at) && from.row === target.row
  const placed = withCell(from && !sameRow ? withoutSpan(block) : block, at)
  const rows = toRows(rest.filter((b) => inCell(b, at)))
  const r = target ? rows.findIndex((row) => row.some((b) => b.id === target.id)) : -1
  if (r < 0) rows.push([placed])
  else {
    const row = rows[r]!
    const c = row.findIndex((b) => b.id === target!.id)
    if (side === 'left') row.splice(c, 0, placed)
    else if (side === 'right') row.splice(c + 1, 0, placed)
    else rows.splice(side === 'before' ? r : r + 1, 0, [placed])
  }
  const next = fromRows(rows)
  // The cell's blocks go back where the cell first appeared, so unrelated blocks keep their places.
  const out: Block[] = []
  let emitted = false
  for (const b of rest) {
    if (!inCell(b, at)) out.push(b)
    else if (!emitted) {
      out.push(...next)
      emitted = true
    }
  }
  return emitted ? out : [...out, ...next]
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
