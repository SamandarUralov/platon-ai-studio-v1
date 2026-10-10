import { describe, expect, it } from 'vitest'
import { makeStep, ROOT, type Api, type LogicFunction, type Step } from '@platon/definition'
import { fieldopsDefinition } from '@platon/mocks/seed'
import { flattenSteps, stepNumbers } from './rows'
import { flowLayout, FLOW } from './flowLayout'
import { checkReturn, inferVars, signature } from './infer'
import { describeCron, nextRuns, parseCron } from './cron'
import { apiLabel, convertProtocol, payloadExample, protoMessage, syncPathParams } from './apis'
import { buildNavRows, packageSubtree } from './nav'
import { toSnake, uniqueId } from './items'

const def = fieldopsDefinition()
const fn = (id: string) => def.logic.functions.find((f) => f.id === id)!

function chain(n: number): Step[] {
  return Array.from({ length: n }, (_, i) => makeStep('set', { name: `v${i}`, value: String(i) }))
}

describe('flattenSteps', () => {
  it('emits gaps, steps, branch labels and end rows in reading order', () => {
    const rows = flattenSteps(fn('send_customer_sms').steps)
    const kinds = rows.map((r) => r.k)
    expect(kinds.slice(0, 4)).toEqual(['gap', 'step', 'gap', 'step'])
    const br = rows.filter((r) => r.k === 'branch').map((r) => (r.k === 'branch' ? r.label : ''))
    expect(br).toEqual(['Then', 'Else'])
    expect(rows.at(-1)).toMatchObject({ k: 'end', branchId: ROOT, depth: 0 })
    // Then has one step + end, Else is empty (end only)
    expect(rows.filter((r) => r.k === 'end')).toHaveLength(3)
  })

  it('hides children of collapsed steps', () => {
    const steps = fn('assign_nearest_tech').steps
    const ifStep = steps[2]!
    const all = flattenSteps(steps)
    const folded = flattenSteps(steps, new Set([ifStep.id]))
    expect(folded.length).toBeLessThan(all.length)
    expect(folded.find((r) => r.k === 'step' && r.step.id === ifStep.id)).toMatchObject({ collapsed: true })
  })

  it('numbers steps depth-first', () => {
    const nums = stepNumbers(fn('calc_sla_due').steps)
    expect(nums.size).toBe(8)
    expect(nums.get(fn('calc_sla_due').steps[3]!.id)).toBe(7)
  })

  it('stays fast for 300 layers', () => {
    const steps = chain(300)
    const t = performance.now()
    for (let i = 0; i < 20; i++) flattenSteps(steps)
    expect((performance.now() - t) / 20).toBeLessThan(10)
  })
})

describe('flowLayout', () => {
  it('stacks a straight sequence vertically', () => {
    const L = flowLayout(chain(3))
    expect(L.nodes).toHaveLength(3)
    expect(new Set(L.nodes.map((n) => n.x)).size).toBe(1)
    expect(L.nodes[1]!.y - L.nodes[0]!.y).toBe(FLOW.H + FLOW.VG)
    expect(L.pills.map((p) => p.label)).toEqual(['Start', 'End'])
  })

  it('places branches side by side and centres the parent over them', () => {
    const L = flowLayout(fn('calc_sla_due').steps)
    const sw = L.nodes.find((n) => n.step.type === 'switch')!
    const cases = L.nodes.filter((n) => n.step.type === 'set' && n.step.config.name === 'hours')
    expect(cases).toHaveLength(3)
    expect(new Set(cases.map((n) => n.y)).size).toBe(1)
    const xs = cases.map((n) => n.x).sort((a, b) => a - b)
    expect(xs[1]! - xs[0]!).toBe(FLOW.W + FLOW.HG)
    expect(sw.x).toBe(xs[1])
    expect(L.labels.map((l) => l.label)).toEqual(['Case urgent', 'Case high', 'Default'])
    expect(L.width).toBe(3 * FLOW.W + 2 * FLOW.HG + 2 * FLOW.P)
  })

  it('handles an empty function', () => {
    const L = flowLayout([])
    expect(L.nodes).toEqual([])
    expect(L.height).toBeGreaterThan(0)
  })
})

describe('type inference and Return checks', () => {
  const fns = def.logic.functions
  it('infers query, call and loop variables', () => {
    const steps = fn('generate_invoice_pdf').steps
    const vars = inferVars(
      steps,
      null,
      fn('generate_invoice_pdf').params,
      fns,
      def.data.tables.map((t) => t.id),
    )
    const byName = Object.fromEntries(vars.map((v) => [v.name, v.type]))
    expect(byName['input.order_id']).toBe('string')
    expect(byName.order).toBe('row<work_orders>')
    expect(byName.parts).toBe('array<parts_used>')
    expect(byName.part).toBe('row<parts_used>')
    expect(byName.pdf).toBe('object')
  })

  it('stops at the given layer', () => {
    const steps = fn('calc_sla_due').steps
    const vars = inferVars(steps, steps[1]!.id, [], fns)
    expect(vars.map((v) => v.name)).toEqual(['order'])
  })

  it('accepts a matching return and reports mismatches', () => {
    const f = fn('list_work_orders')
    const ret = f.steps.at(-1)!
    expect(checkReturn(f, ret, f.steps, fns).error).toBeUndefined()

    const bad: LogicFunction = {
      ...f,
      steps: [f.steps[0]!, makeStep('return', { from: 'var', value: 'items' })],
    }
    const r = checkReturn(bad, bad.steps[1]!, bad.steps, fns)
    expect(r.error).toMatch(/expected/)
  })

  it('checks argument counts of a returned function call', () => {
    const f = fn('update_order_status')
    const step = makeStep('return', { from: 'fn', fn: 'updateOrderStatus', args: 'input.order_id' })
    const r = checkReturn(f, step, [step], fns)
    expect(r.error).toMatch(/expects 2 arguments, gets 1/)
  })

  it('defaults to the last function result', () => {
    const steps = [
      makeStep('call', { fn: 'createWorkOrder', args: 'a, b, c, d', into: 'order' }),
      makeStep('set', { name: 'x', value: '1' }),
      makeStep('return', { from: 'var', value: '' }),
    ]
    const r = checkReturn({ params: [], returns: { type: 'object' } }, steps[2]!, steps, fns)
    expect(r.defaultVar).toBe('order')
    expect(r.error).toBeUndefined()
  })

  it('formats signatures', () => {
    expect(signature(fn('assign_nearest_tech'))).toBe(
      '(order_id: string, trade: string) → { assigned: boolean, technician?: string }',
    )
  })
})

describe('cron', () => {
  it('describes schedules', () => {
    expect(describeCron('0 2 * * *')).toMatch(/02:00/)
    expect(describeCron('nope')).toBeNull()
  })

  it('parses names, ranges and steps', () => {
    const c = parseCron('*/15 8-10 * * MON-FRI')!
    expect([...c.minute.set]).toEqual([0, 15, 30, 45])
    expect([...c.hour.set]).toEqual([8, 9, 10])
    expect([...c.dow.set]).toEqual([1, 2, 3, 4, 5])
    expect(parseCron('61 * * * *')).toBeNull()
    expect(parseCron('* * *')).toBeNull()
  })

  it('computes next runs in the cron timezone', () => {
    const from = new Date('2026-10-09T12:00:00Z')
    const runs = nextRuns('0 2 * * *', 'UTC', 3, from)
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-10-10T02:00:00.000Z',
      '2026-10-11T02:00:00.000Z',
      '2026-10-12T02:00:00.000Z',
    ])
    // 02:00 in Los Angeles (PDT, UTC-7) is 09:00 UTC
    expect(nextRuns('0 2 * * *', 'America/Los_Angeles', 1, from)[0]!.toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    )
    // Friday Oct 9 → next Monday Oct 12
    expect(nextRuns('0 8 * * MON', 'UTC', 1, from)[0]!.toISOString()).toBe('2026-10-12T08:00:00.000Z')
    expect(nextRuns('*/15 * * * *', 'UTC', 2, from).map((d) => d.toISOString())).toEqual([
      '2026-10-09T12:15:00.000Z',
      '2026-10-09T12:30:00.000Z',
    ])
  })
})

describe('API helpers', () => {
  const api = (id: string) => def.logic.apis.find((a) => a.id === id)!
  it('labels each protocol', () => {
    expect(apiLabel(api('patch_status'))).toMatchObject({
      badge: 'PATCH',
      text: '/api/work-orders/:id/status',
    })
    expect(apiLabel(api('erp_update_status'))).toMatchObject({
      badge: 'SOAP',
      text: 'WorkOrderService.UpdateStatus',
    })
    expect(apiLabel(api('grpc_assign_tech')).badge).toBe('gRPC')
  })

  it('converts protocols and keeps inputs', () => {
    const a = api('patch_status')
    const soap = convertProtocol(a, 'soap')
    expect(Object.keys(soap.responses)).toEqual(['Response', 'Fault'])
    expect(soap.request.body.map((f) => f.name)).toEqual(['id', 'status'])
    expect(soap.request.path).toEqual([])
    const back = convertProtocol(soap, 'rest')
    expect(back.request.path.map((f) => f.name)).toEqual([])
    expect(Object.keys(back.responses)).toContain('200')
  })

  it('syncs path params with the path', () => {
    const a: Api = { ...api('get_work_orders'), path: '/api/sites/:site_id/orders/:id' }
    expect(syncPathParams(a).request.path.map((f) => [f.name, f.req])).toEqual([
      ['site_id', true],
      ['id', true],
    ])
  })

  it('builds protocol examples', () => {
    expect(protoMessage('Req', [{ name: 'a', type: 'string', req: false }])).toEqual([
      'message Req {',
      '  optional string a = 1;',
      '}',
    ])
    expect(
      payloadExample('soap', [{ name: 'id', type: 'string', req: true }], 'request', {
        operation: 'UpdateStatus',
      }),
    ).toContain('<tns:UpdateStatus>')
    expect(JSON.parse(payloadExample('jsonrpc', [], 'request', { operation: 'x.list' }))).toMatchObject({
      jsonrpc: '2.0',
      method: 'x.list',
    })
  })
})

describe('navigation tree', () => {
  it('groups items into packages and resolves packages by name', () => {
    const pk = (def.logic.packages ?? []).filter((p) => p.kind === 'apis')
    const entries = def.logic.apis.map((a) => ({
      kind: 'apis' as const,
      id: a.id,
      label: a.path,
      package: a.package,
    }))
    const closed = buildNavRows(entries, pk, new Set())
    expect(closed.filter((r) => r.k === 'pkg')).toHaveLength(2)
    expect(closed.filter((r) => r.k === 'item')).toHaveLength(0)
    const open = buildNavRows(entries, pk, new Set(pk.map((p) => p.id)))
    expect(open.filter((r) => r.k === 'item')).toHaveLength(def.logic.apis.length)
  })

  it('finds nested package subtrees', () => {
    const pk = [
      { id: 'a', name: 'a', kind: 'functions' as const },
      { id: 'b', name: 'b', kind: 'functions' as const, parent: 'a' },
      { id: 'c', name: 'c', kind: 'functions' as const, parent: 'b' },
    ]
    expect([...packageSubtree('a', pk)].sort()).toEqual(['a', 'b', 'c'])
    const rows = buildNavRows(
      [{ kind: 'functions', id: 'f', label: 'f', package: 'c' }],
      pk,
      new Set(['a', 'b', 'c']),
    )
    expect(rows.map((r) => [r.k, r.depth])).toEqual([
      ['pkg', 0],
      ['pkg', 1],
      ['pkg', 2],
      ['item', 3],
    ])
  })
})

describe('ids', () => {
  it('derives snake ids', () => {
    expect(toSnake('assignNearestTech')).toBe('assign_nearest_tech')
    expect(uniqueId('newFunction', ['new_function'])).toBe('new_function_2')
  })
})
