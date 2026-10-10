import { describe, expect, it } from 'vitest'
import { makeStep } from '@platon/definition'
import { fieldopsDefinition } from '../seed/fieldops'
import { simCondition, simEval, simulate } from './logic'

const def = fieldopsDefinition()
const fns = def.logic.functions
const fn = (id: string) => fns.find((f) => f.id === id)!

describe('simulated test runs', () => {
  it('is deterministic for the same run number', () => {
    const f = fn('calc_sla_due')
    const a = simulate(
      f.steps,
      { order_id: 'WO-1042' },
      { n: 1, functions: fns, returns: f.returns.type, params: f.params },
    )
    const b = simulate(
      f.steps,
      { order_id: 'WO-1042' },
      { n: 1, functions: fns, returns: f.returns.type, params: f.params },
    )
    expect(a).toEqual(b)
    expect(a.ok).toBe(true)
    expect(a.returned).toBe(true)
  })

  it('takes the matching switch case and skips the others', () => {
    const f = fn('calc_sla_due')
    const r = simulate(f.steps, { order_id: 'WO-1042' }, { n: 2, functions: fns, params: f.params })
    const sw = r.trace.find((t) => t.type === 'switch')!
    expect(sw.output).toContain('Case high')
    expect(r.trace.filter((t) => t.status === 'skip')).toHaveLength(2)
    expect(r.ran + 2).toBe(r.total)
  })

  it('evaluates if conditions on query results', () => {
    const f = fn('assign_nearest_tech')
    const r = simulate(
      f.steps,
      { order_id: 'WO-1', trade: 'HVAC' },
      { n: 1, functions: fns, returns: 'object', params: f.params },
    )
    // two technicians come back, so `techs.length == 0` is false and Else runs
    expect(r.trace.find((t) => t.type === 'if')!.output).toContain('Else')
    expect(r.output).toMatchObject({ assigned: true, technician: 'tech_07' })
  })

  it('fails on missing inputs and skips the rest', () => {
    const f = fn('calc_sla_due')
    const r = simulate(f.steps, { order_id: '' }, { n: 1, functions: fns, params: f.params })
    expect(r.ok).toBe(false)
    expect(r.error).toMatchObject({ code: 'missing_input', stepId: f.steps[0]!.id })
    expect(r.failIndex).toBe(1)
    expect(r.trace.filter((t) => t.status === 'skip').length).toBe(r.total - 1)
  })

  it('stops at layers with validation errors', () => {
    const f = fn('list_work_orders')
    const r = simulate(
      f.steps,
      { status: 'open', cursor: '' },
      {
        n: 1,
        functions: fns,
        params: [{ name: 'status', type: 'string', req: true }],
        stepErrors: { [f.steps[1]!.id]: 'boom' },
      },
    )
    expect(r.error).toMatchObject({ code: 'type_error', message: 'boom' })
  })

  it('runs called functions and returns their result', () => {
    const steps = [makeStep('call', { fn: 'updateOrderStatus', args: 'input.id, "done"', into: 'result' })]
    const r = simulate(steps, { id: 'WO-1' }, { n: 1, functions: fns })
    expect(r.ok).toBe(true)
    expect(r.output).toEqual({ ok: true })
  })

  it('loops over list items', () => {
    const f = fn('generate_invoice_pdf')
    const r = simulate(f.steps, { order_id: 'WO-1' }, { n: 1, functions: fns, params: f.params })
    expect(r.trace.find((t) => t.type === 'for')!.output).toMatch(/^2 iterations/)
  })
})

describe('expression helpers', () => {
  it('reads literals, paths and objects', () => {
    expect(simEval('42', {}, {})).toBe(42)
    expect(simEval('"x"', {}, {})).toBe('x')
    expect(simEval('input.a', {}, { a: 'b' })).toBe('b')
    expect(simEval('{ ok: true, n: x }', { x: 3 }, {})).toEqual({ ok: true, n: 3 })
  })
  it('compares values', () => {
    expect(simCondition('x.length == 0', { x: [] }, {})).toBe(true)
    expect(simCondition('res.status != 200', { res: { status: 200 } }, {})).toBe(false)
    expect(simCondition('unknown(x)', {}, {})).toBe(true)
  })
})
