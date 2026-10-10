/**
 * Flattens the layer tree into rows for the builder (requirements §3.3). A flat list keeps the
 * tree editor cheap at 300 layers: every row is a light, keyed element and branches are just depth.
 */
import { ROOT, type Step, type StepType } from '@platon/definition'

export type BuilderRow =
  | { k: 'gap'; key: string; depth: number; branchId: string; index: number }
  | {
      k: 'step'
      key: string
      depth: number
      step: Step
      branchId: string
      index: number
      length: number
      collapsed: boolean
    }
  | {
      k: 'branch'
      key: string
      depth: number
      label: string
      parentType: StepType
      branchId: string
      count: number
    }
  | { k: 'end'; key: string; depth: number; branchId: string; index: number }

export function flattenSteps(steps: Step[], collapsed: ReadonlySet<string> = new Set()): BuilderRow[] {
  const out: BuilderRow[] = []
  const walk = (list: Step[], depth: number, branchId: string) => {
    list.forEach((s, i) => {
      out.push({ k: 'gap', key: `g:${branchId}:${i}`, depth, branchId, index: i })
      const isCollapsed = !!s.branches && collapsed.has(s.id)
      out.push({
        k: 'step',
        key: s.id,
        depth,
        step: s,
        branchId,
        index: i,
        length: list.length,
        collapsed: isCollapsed,
      })
      if (s.branches && !isCollapsed)
        for (const b of s.branches) {
          out.push({
            k: 'branch',
            key: `b:${b.id}`,
            depth: depth + 1,
            label: b.label,
            parentType: s.type,
            branchId: b.id,
            count: b.steps.length,
          })
          walk(b.steps, depth + 1, b.id)
        }
    })
    out.push({ k: 'end', key: `e:${branchId}`, depth, branchId, index: list.length })
  }
  walk(steps, 0, ROOT)
  return out
}

/** Position of a step in reading order (1-based), used by "Failed at layer N". */
export function stepNumbers(steps: Step[]): Map<string, number> {
  const m = new Map<string, number>()
  const walk = (list: Step[]) => {
    for (const s of list) {
      m.set(s.id, m.size + 1)
      for (const b of s.branches ?? []) walk(b.steps)
    }
  }
  walk(steps)
  return m
}
