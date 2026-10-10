/**
 * Flowchart layout for the layer tree: a top-down column with branches side by side.
 * The tree shape is fixed (no crossings), so a direct recursive layout is exact and runs in
 * linear time — no need to load ELK for it.
 */
import type { Step, StepType } from '@platon/definition'

export interface FlowNode {
  x: number
  y: number
  step: Step
}
export interface FlowSegment {
  x: number
  y: number
  w: number
  h: number
}
export interface FlowLabel {
  x: number
  y: number
  label: string
  parentType: StepType
}
export interface FlowLayout {
  width: number
  height: number
  nodes: FlowNode[]
  segments: FlowSegment[]
  labels: FlowLabel[]
  pills: { x: number; y: number; label: 'Start' | 'End' }[]
}

export const FLOW = { W: 220, H: 56, VG: 32, HG: 28, LB: 30, P: 28, PH: 30 } as const

export function flowLayout(steps: Step[]): FlowLayout {
  const { W, H, VG, HG, LB, P, PH } = FLOW
  const nodes: FlowNode[] = []
  const segments: FlowSegment[] = []
  const labels: FlowLabel[] = []
  const v = (x: number, a: number, b: number) => {
    if (b > a) segments.push({ x: x - 1, y: a, w: 2, h: b - a })
  }
  const hz = (a: number, b: number, y: number) => {
    if (b > a) segments.push({ x: a, y: y - 1, w: b - a, h: 2 })
  }

  // Width/height are memoised per step: nested branches would otherwise be measured repeatedly.
  const wMemo = new Map<Step, number>()
  const hMemo = new Map<Step, number>()
  const widthOf = (s: Step): number => {
    let w = wMemo.get(s)
    if (w === undefined) {
      w = s.branches?.length
        ? Math.max(W, s.branches.reduce((a, b) => a + widthOfList(b.steps), 0) + HG * (s.branches.length - 1))
        : W
      wMemo.set(s, w)
    }
    return w
  }
  const widthOfList = (list: Step[]) => Math.max(W, ...list.map(widthOf))
  const heightOf = (s: Step): number => {
    let h = hMemo.get(s)
    if (h === undefined) {
      h = s.branches?.length
        ? H + VG + LB + Math.max(0, ...s.branches.map((b) => heightOfList(b.steps))) + VG
        : H
      hMemo.set(s, h)
    }
    return h
  }
  const heightOfList = (list: Step[]) =>
    list.length ? list.reduce((a, s) => a + heightOf(s), 0) + VG * (list.length - 1) : 0

  const seq = (list: Step[], x0: number, y: number, w: number) => {
    const cx = x0 + w / 2
    list.forEach((s, i) => {
      if (i) v(cx, y - VG, y)
      item(s, cx, y)
      y += heightOf(s) + VG
    })
  }
  const item = (s: Step, cx: number, y: number) => {
    nodes.push({ x: cx - W / 2, y, step: s })
    if (!s.branches?.length) return
    const ws = s.branches.map((b) => widthOfList(b.steps))
    const tot = ws.reduce((a, b) => a + b, 0) + HG * (ws.length - 1)
    const sy = y + H + VG / 2
    const top = y + H + VG + LB
    const mh = Math.max(0, ...s.branches.map((b) => heightOfList(b.steps)))
    const my = top + mh + VG / 2
    v(cx, y + H, sy)
    let bx = cx - tot / 2
    const centres: number[] = []
    s.branches.forEach((b, j) => {
      const bc = bx + ws[j]! / 2
      centres.push(bc)
      v(bc, sy, top)
      labels.push({ x: bc, y: sy + 5, label: b.label, parentType: s.type })
      seq(b.steps, bx, top, ws[j]!)
      v(bc, top + heightOfList(b.steps), my)
      bx += ws[j]! + HG
    })
    hz(centres[0]!, centres[centres.length - 1]!, sy)
    hz(centres[0]!, centres[centres.length - 1]!, my)
    v(cx, my, my + VG / 2)
  }

  const w = widthOfList(steps)
  const cx = P + w / 2
  const y0 = P + PH + VG
  v(cx, P + PH, y0)
  seq(steps, P, y0, w)
  const ye = y0 + heightOfList(steps) + (steps.length ? VG : 0)
  if (steps.length) v(cx, ye - VG, ye)
  return {
    width: w + 2 * P,
    height: ye + PH + P,
    nodes,
    segments,
    labels,
    pills: [
      { x: cx, y: P, label: 'Start' },
      { x: cx, y: ye, label: 'End' },
    ],
  }
}
