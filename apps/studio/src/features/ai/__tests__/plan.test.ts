import { describe, expect, it } from 'vitest'
import type { AiPlan } from '@platon/definition'
import { groupPlanItems, planToChanges } from '../plan'

const plan: AiPlan = {
  id: 'plan_x',
  title: 'Test',
  status: 'pending',
  items: [
    {
      id: 'a',
      area: 'Pages',
      title: 'A',
      detail: '',
      meta: '',
      status: 'pending',
      change: { key: 'k.a', area: 'Pages', text: 'A', ops: [{ op: 'add', path: '/x', value: 1 }] },
    },
    {
      id: 'b',
      area: 'Database',
      title: 'B',
      detail: '',
      meta: '',
      status: 'pending',
      change: { key: 'k.b', area: 'Database', text: 'B', ops: [{ op: 'remove', path: '/y' }] },
    },
    {
      id: 'c',
      area: 'Pages',
      title: 'C',
      detail: '',
      meta: '',
      status: 'pending',
      change: { key: 'k.c', area: 'Pages', text: 'C', ops: [{ op: 'replace', path: '/z', value: 'v' }] },
    },
  ],
}

describe('planToChanges', () => {
  it('returns only checked items, in plan order, as ChangeInputs', () => {
    const out = planToChanges(plan, new Set(['c', 'a']))
    expect(out.map((c) => c.key)).toEqual(['k.a', 'k.c'])
    expect(out[0]).toEqual({
      key: 'k.a',
      area: 'Pages',
      text: 'A',
      ops: [{ op: 'add', path: '/x', value: 1 }],
    })
  })

  it('returns nothing when nothing is checked', () => {
    expect(planToChanges(plan, new Set())).toEqual([])
  })

  it('copies ops so the store cannot mutate the plan', () => {
    const [c] = planToChanges(plan, new Set(['a']))
    c!.ops[0]!.path = '/changed'
    expect(plan.items[0]!.change.ops[0]!.path).toBe('/x')
  })
})

describe('groupPlanItems', () => {
  it('groups by area in catalog order', () => {
    const g = groupPlanItems(plan.items)
    expect(g.map((x) => x.area)).toEqual(['Pages', 'Database'])
    expect(g[0]!.items.map((i) => i.id)).toEqual(['a', 'c'])
  })
})
