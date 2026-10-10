import { describe, expect, it } from 'vitest'
import { fieldopsDefinition } from '@platon/mocks/seed'
import { validateAll, splitArgs, scriptProblems } from '../src'

describe('validators on the FieldOps seed', () => {
  const problems = validateAll(fieldopsDefinition())

  it('flags the deliberate arg-count problem in parts_webhook', () => {
    const p = problems.find((x) => x.path.startsWith('/logic/apis/parts_webhook') && x.code === 'arg_count')
    expect(p?.message).toMatch(/updateOrderStatus expects 2 arguments, got 1/)
  })

  it('has no errors anywhere else', () => {
    const errors = problems.filter(
      (p) => p.severity === 'error' && !p.path.startsWith('/logic/apis/parts_webhook'),
    )
    expect(errors).toEqual([])
  })
})

describe('splitArgs', () => {
  it('splits on top-level commas only', () => {
    expect(splitArgs('a, f(b, c), { d, e }, "x, y"')).toEqual(['a', 'f(b, c)', '{ d, e }', '"x, y"'])
    expect(splitArgs('')).toEqual([])
  })
})

describe('scriptProblems', () => {
  const def = fieldopsDefinition()
  const page = def.interface.pages.find((p) => p.id === 'orders')!
  it('reports sandbox, unknown block, unknown event and unknown function', () => {
    const src = `fetch('/x')\nctx.blocks.nope.reload()\nexport default definePage({ on: { 'allWorkOrders.hover': () => {} } })\nctx.call('missingFn')`
    const codes = scriptProblems(page, src, def, '/p').map((p) => `${p.code}@${p.line}`)
    expect(codes).toEqual(
      expect.arrayContaining(['sandbox@1', 'unknown_block@2', 'unknown_event@3', 'unknown_function@4']),
    )
  })
  it('reports unbalanced brackets', () => {
    expect(scriptProblems(page, 'definePage({ on: {', def, '/p').some((p) => p.code === 'syntax')).toBe(true)
  })
})
