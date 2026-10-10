/**
 * ER diagram geometry: node sizes, link edges, a synchronous grid fallback and an ELK layered
 * auto-arrange (ELK is imported lazily so it never lands in the initial bundle).
 */
import type { Table } from '@platon/definition'

export const ER = { width: 240, head: 36, row: 26, gapX: 90, gapY: 40, pad: 24 } as const

export interface Pos {
  x: number
  y: number
}
export type Positions = Record<string, Pos>

export interface ErEdge {
  id: string
  from: string
  fieldKey: string
  /** Row index of the link field inside the source card (0 = the id row). */
  fieldRow: number
  to: string
}

/** Card height: header + id row + one row per field. */
export function nodeHeight(t: Pick<Table, 'fields'>): number {
  return ER.head + ER.row * (t.fields.length + 1)
}

export function erEdges(tables: Table[]): ErEdge[] {
  const ids = new Set(tables.map((t) => t.id))
  const out: ErEdge[] = []
  for (const t of tables)
    t.fields.forEach((f, i) => {
      if (f.type === 'link' && f.link && ids.has(f.link))
        out.push({ id: `${t.id}.${f.key}`, from: t.id, fieldKey: f.key, fieldRow: i + 1, to: f.link })
    })
  return out
}

/** Column-packed grid, used before ELK has loaded and for tables without a saved position. */
export function gridLayout(tables: Table[], cols = 3): Positions {
  const colY = Array.from({ length: cols }, () => ER.pad)
  const out: Positions = {}
  tables.forEach((t, i) => {
    const c = i % cols
    out[t.id] = { x: ER.pad + c * (ER.width + ER.gapX), y: colY[c]! }
    colY[c]! += nodeHeight(t) + ER.gapY
  })
  return out
}

/** Merge saved positions over a fallback layout; drop positions of tables that no longer exist. */
export function mergePositions(tables: Table[], saved: Positions, fallback: Positions): Positions {
  const out: Positions = {}
  for (const t of tables) out[t.id] = saved[t.id] ?? fallback[t.id] ?? { x: ER.pad, y: ER.pad }
  return out
}

export async function elkLayout(tables: Table[]): Promise<Positions> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': String(ER.gapY),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ER.gapX),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.padding': `[top=${ER.pad},left=${ER.pad},bottom=${ER.pad},right=${ER.pad}]`,
    },
    children: tables.map((t) => ({ id: t.id, width: ER.width, height: nodeHeight(t) })),
    // Edges point from the referenced table to the referencing one so parents sit on the left.
    edges: erEdges(tables).map((e) => ({ id: e.id, sources: [e.to], targets: [e.from] })),
  })
  const out: Positions = {}
  for (const c of res.children ?? []) out[c.id] = { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) }
  return out
}

export interface EdgePath {
  id: string
  d: string
  from: Pos
  to: Pos
  hot: boolean
}

/** Bezier from the link field row (N side) to the target card header (1 side). */
export function edgePath(e: ErEdge, pos: Positions, activeId?: string | null): EdgePath | null {
  const a = pos[e.from]
  const b = pos[e.to]
  if (!a || !b) return null
  const y1 = a.y + ER.head + e.fieldRow * ER.row + ER.row / 2
  const y2 = b.y + ER.head / 2
  if (e.from === e.to) {
    const x = a.x + ER.width
    return {
      id: e.id,
      d: `M ${x} ${y1} C ${x + 60} ${y1}, ${x + 60} ${y2}, ${x} ${y2}`,
      from: { x, y: y1 },
      to: { x, y: y2 },
      hot: e.from === activeId,
    }
  }
  const right = b.x >= a.x + ER.width / 2
  const x1 = right ? a.x + ER.width : a.x
  const x2 = right ? b.x : b.x + ER.width
  const dx = Math.max(40, Math.abs(x2 - x1) / 2) * (right ? 1 : -1)
  return {
    id: e.id,
    d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
    hot: !!activeId && (e.from === activeId || e.to === activeId),
  }
}

export function canvasSize(tables: Table[], pos: Positions): { w: number; h: number } {
  let w = 600
  let h = 300
  for (const t of tables) {
    const p = pos[t.id]
    if (!p) continue
    w = Math.max(w, p.x + ER.width)
    h = Math.max(h, p.y + nodeHeight(t))
  }
  return { w: w + 80, h: h + 40 }
}
