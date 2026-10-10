import { describe, expect, it } from 'vitest'
import {
  countSteps,
  findStep,
  insertStep,
  locateStep,
  makeStep,
  moveStep,
  removeStep,
  ROOT,
  stepSummary,
} from '../src/steps'
import { placeBlock, toRows } from '../src/blocks'
import { typeFits } from '../src/types'
import { upsertChange, makeChange } from '../src/changes'
import type { Block } from '../src'

describe('step tree', () => {
  const ifStep = makeStep('if', { condition: 'size(techs) == 0' })
  const ret = makeStep('return', { value: 'result' })
  const tree = [ifStep, ret]

  it('creates default branches', () => {
    expect(ifStep.branches?.map((b) => b.label)).toEqual(['Then', 'Else'])
    expect(makeStep('switch', { cases: 'urgent, normal' }).branches?.map((b) => b.label)).toEqual([
      'Case urgent',
      'Case normal',
      'Default',
    ])
  })

  it('inserts into a branch, finds and locates', () => {
    const call = makeStep('call', { fn: 'notify' })
    const t = insertStep(tree, ifStep.branches![0]!.id, 0, call)
    expect(findStep(t, call.id)).toBeDefined()
    expect(locateStep(t, call.id)).toEqual({ branchId: ifStep.branches![0]!.id, index: 0, length: 1 })
    expect(countSteps(t)).toBe(3)
    expect(countSteps(removeStep(t, call.id))).toBe(2)
  })

  it('moves within the root and refuses moving into own subtree', () => {
    expect(moveStep(tree, ret.id, ROOT, 0).map((s) => s.id)).toEqual([ret.id, ifStep.id])
    expect(moveStep(tree, ifStep.id, ifStep.branches![1]!.id, 0)).toBe(tree)
  })

  it('summarises steps', () => {
    expect(stepSummary(ifStep)).toBe('if size(techs) == 0')
  })
})

describe('block rows', () => {
  const b = (id: string, row: number): Block => ({ id, type: 'text', ref: id, row, props: {} })
  it('places blocks left/right/before/after and renumbers rows', () => {
    const blocks = [b('a', 0), b('b', 1)]
    expect(toRows(placeBlock(blocks, b('c', 9), 'a', 'right')).map((r) => r.map((x) => x.id))).toEqual([
      ['a', 'c'],
      ['b'],
    ])
    expect(toRows(placeBlock(blocks, b('c', 9), 'b', 'before')).map((r) => r.map((x) => x.id))).toEqual([
      ['a'],
      ['c'],
      ['b'],
    ])
    expect(placeBlock(blocks, b('c', 9), null).map((x) => x.row)).toEqual([0, 1, 2])
  })
})

describe('typeFits', () => {
  it('accepts row<t> as object and flags missing required fields', () => {
    expect(typeFits('row<orders>', undefined, 'object', undefined)).toBe('')
    expect(typeFits('string', undefined, 'boolean', undefined)).toMatch(/expected boolean/)
    expect(
      typeFits('object', [{ name: 'a', type: 'string', req: true }], 'object', [
        { name: 'a', type: 'string', req: true },
        { name: 'b', type: 'boolean', req: true },
      ]),
    ).toMatch(/missing required field “b”/)
  })
})

describe('change log', () => {
  it('upserts by key while unreleased', () => {
    const c1 = makeChange(
      { key: 'k', area: 'Logic', text: 'one', ops: [{ op: 'replace', path: '/a', value: 1 }] },
      'me',
      1,
    )
    const c2 = makeChange(
      { key: 'k', area: 'Logic', text: 'two', ops: [{ op: 'replace', path: '/a', value: 2 }] },
      'me',
      2,
    )
    const log = upsertChange(upsertChange([], c1), c2)
    expect(log).toHaveLength(1)
    expect(log[0]!.text).toBe('two')
    expect(log[0]!.ops).toHaveLength(2)
    expect(log[0]!.id).toBe(c1.id)
  })
})
