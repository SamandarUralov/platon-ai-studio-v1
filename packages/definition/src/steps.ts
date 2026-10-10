/** Helpers for the function/API/cron step tree (requirements §3.3). */
import type { Step, StepBranch, StepType } from './generated/app-definition'
import { newId } from './ids'

export const STEP_DEFAULTS: Record<StepType, Record<string, string>> = {
  if: { condition: 'value == true' },
  switch: { value: 'input.status', cases: 'a, b' },
  for: { list: 'items', as: 'item' },
  set: { name: 'x', value: '0' },
  return: { from: 'var', value: '' },
  select: { table: '', where: '', limit: '50', into: 'rows' },
  execute: { sql: '' },
  http: { method: 'POST', url: 'https://api.example.com', body: '{ }', into: 'res' },
  produce: { queue: '', message: '{ }' },
  consume: { queue: '', into: 'msg' },
  call: { fn: '', args: '', into: 'result' },
}

function defaultBranches(type: StepType, config: Record<string, string>): StepBranch[] | undefined {
  const br = (label: string): StepBranch => ({ id: newId('br'), label, steps: [] })
  if (type === 'if') return [br('Then'), br('Else')]
  if (type === 'switch')
    return [
      ...(config.cases ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => br(`Case ${c}`)),
      br('Default'),
    ]
  if (type === 'for') return [br(`Each ${config.as ?? 'item'}`)]
  return undefined
}

export function makeStep(type: StepType, config: Record<string, string> = {}): Step {
  const cfg = { ...STEP_DEFAULTS[type], ...config }
  const branches = defaultBranches(type, cfg)
  return { id: newId('st'), type, config: cfg, ...(branches ? { branches } : {}) }
}

/** Deep copy with fresh ids (duplicate action). */
export function cloneStep(step: Step): Step {
  return {
    ...step,
    id: newId('st'),
    config: { ...step.config },
    ...(step.branches
      ? { branches: step.branches.map((b) => ({ ...b, id: newId('br'), steps: b.steps.map(cloneStep) })) }
      : {}),
  }
}

export const ROOT = 'root'

/** Insert `node` into branch `branchId` (or the root list) at `index`. */
export function insertStep(steps: Step[], branchId: string, index: number, node: Step): Step[] {
  if (branchId === ROOT) {
    const a = steps.slice()
    a.splice(index, 0, node)
    return a
  }
  return steps.map((s) =>
    s.branches
      ? {
          ...s,
          branches: s.branches.map((b) =>
            b.id === branchId
              ? { ...b, steps: insertStep(b.steps, ROOT, index, node) }
              : { ...b, steps: insertStep(b.steps, branchId, index, node) },
          ),
        }
      : s,
  )
}

export function removeStep(steps: Step[], id: string): Step[] {
  return steps
    .filter((s) => s.id !== id)
    .map((s) =>
      s.branches ? { ...s, branches: s.branches.map((b) => ({ ...b, steps: removeStep(b.steps, id) })) } : s,
    )
}

export function updateStep(steps: Step[], id: string, fn: (s: Step) => Step): Step[] {
  return steps.map((s) =>
    s.id === id
      ? fn(s)
      : s.branches
        ? { ...s, branches: s.branches.map((b) => ({ ...b, steps: updateStep(b.steps, id, fn) })) }
        : s,
  )
}

export function findStep(steps: Step[], id: string): Step | undefined {
  for (const s of steps) {
    if (s.id === id) return s
    for (const b of s.branches ?? []) {
      const r = findStep(b.steps, id)
      if (r) return r
    }
  }
  return undefined
}

export interface StepLocation {
  branchId: string
  index: number
  length: number
}

export function locateStep(steps: Step[], id: string, branchId: string = ROOT): StepLocation | undefined {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!
    if (s.id === id) return { branchId, index: i, length: steps.length }
    for (const b of s.branches ?? []) {
      const r = locateStep(b.steps, id, b.id)
      if (r) return r
    }
  }
  return undefined
}

/** Move a step to another branch/position. Refuses to move a step into its own subtree. */
export function moveStep(steps: Step[], id: string, branchId: string, index: number): Step[] {
  const node = findStep(steps, id)
  if (!node || (branchId !== ROOT && containsBranch(node, branchId))) return steps
  const from = locateStep(steps, id)
  let at = index
  if (from && from.branchId === branchId && from.index < index) at -= 1
  return insertStep(removeStep(steps, id), branchId, at, node)
}

export function containsBranch(step: Step, branchId: string): boolean {
  return !!step.branches?.some((b) => b.id === branchId || b.steps.some((c) => containsBranch(c, branchId)))
}

export function countSteps(steps: Step[]): number {
  return steps.reduce((n, s) => n + 1 + (s.branches ?? []).reduce((m, b) => m + countSteps(b.steps), 0), 0)
}

export function walkSteps(steps: Step[], fn: (s: Step, depth: number) => void, depth = 0): void {
  for (const s of steps) {
    fn(s, depth)
    for (const b of s.branches ?? []) walkSteps(b.steps, fn, depth + 1)
  }
}

/** One-line human summary used in lists, the flowchart and step cards. */
export function stepSummary(s: Step): string {
  const c = s.config
  switch (s.type) {
    case 'if':
      return `if ${c.condition}`
    case 'switch':
      return `switch ${c.value}`
    case 'for':
      return `for each ${c.as} in ${c.list}`
    case 'set':
      return `${c.name} = ${c.value}`
    case 'return':
      return c.from === 'fn' ? `return ${c.fn}(${c.args ?? ''})` : `return ${c.value || 'result'}`
    case 'select':
      return `${c.into} = select ${c.table}${c.where ? ` where ${c.where}` : ''}`
    case 'execute':
      return (c.sql ?? '').replace(/\s+/g, ' ').trim()
    case 'http':
      return `${c.into ? `${c.into} = ` : ''}${c.method} ${c.url}`
    case 'produce':
      return `send to ${c.queue}`
    case 'consume':
      return `${c.into} = take from ${c.queue}`
    case 'call':
      return `${c.into ? `${c.into} = ` : ''}${c.fn}(${c.args ?? ''})`
  }
}
