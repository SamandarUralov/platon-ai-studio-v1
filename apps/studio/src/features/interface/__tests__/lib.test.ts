import { describe, expect, it } from 'vitest'
import { applyPatch, type AppDefinition, type Page } from '@platon/definition'
import { fieldopsDefinition, ORDERS_CODE } from '../../../../../../mocks/src/seed'
import { ctxTypings, defaultScript, ensureHandler, parseOutline, signature } from '../lib/script'
import { blockPath, setOps } from '../lib/patch'
import { createBlock, paletteGroups, rowLabelOf } from '../lib/blocks'
import { fitZoom, stepZoom } from '../lib/viewport'

const def: AppDefinition = fieldopsDefinition()
const orders = def.interface.pages.find((p) => p.id === 'orders')!

describe('outline', () => {
  it('reads state, computed, hooks and handlers', () => {
    const o = parseOutline(ORDERS_CODE)
    expect(o.map((x) => `${x.kind}:${x.label}`)).toEqual([
      'state:filter',
      'state:selected',
      'computed:overdue',
      'hook:onLoad()',
      'handler:numbers.click',
      'handler:allWorkOrders.rowClick',
      'handler:pageHeader.buttonClick',
    ])
    expect(o.find((x) => x.label === 'onLoad()')!.line).toBe(
      ORDERS_CODE.split('\n').findIndex((l) => l.includes('async onLoad')) + 1,
    )
  })
  it('survives broken code', () => {
    expect(parseOutline('export default definePage({ state: { a: 1, ')).toEqual([
      { label: 'a', kind: 'state', line: 1 },
    ])
    expect(parseOutline('nothing here')).toEqual([])
  })
})

describe('handler stubs', () => {
  it('jumps to an existing handler', () => {
    const r = ensureHandler(ORDERS_CODE, 'allWorkOrders', 'rowClick')
    expect(r.added).toBe(false)
    expect(ORDERS_CODE.split('\n')[r.line - 1]).toContain("'allWorkOrders.rowClick'")
  })
  it('adds a stub into on: { }', () => {
    const r = ensureHandler(ORDERS_CODE, 'allWorkOrders', 'select')
    expect(r.added).toBe(true)
    expect(r.source.split('\n')[r.line - 2]).toContain("'allWorkOrders.select': (ctx, rows) => {")
    expect(parseOutline(r.source).some((x) => x.label === 'allWorkOrders.select')).toBe(true)
  })
  it('creates on: { } when missing', () => {
    const src = 'export default definePage({\n  state: {},\n})\n'
    const r = ensureHandler(src, 'pageHeader', 'buttonClick')
    expect(r.source).toContain("  state: {},\n\n  on: {\n    'pageHeader.buttonClick'")
    expect(parseOutline(r.source).map((x) => x.label)).toContain('pageHeader.buttonClick')
  })
})

describe('default script + typings', () => {
  const page: Page = def.interface.pages.find((p) => p.id === 'customers')!
  it('loads tables and wires row clicks', () => {
    const s = defaultScript(page)
    expect(s).toContain('await ctx.blocks.allCustomers.load()')
    expect(s).toContain("'allCustomers.rowClick'")
    expect(s).toContain("'pageHeader.buttonClick'")
  })
  it('generates ctx typings for blocks and functions', () => {
    const d = ctxTypings(orders, def)
    expect(d).toContain('allWorkOrders: Block_allWorkOrders')
    expect(d).toContain('load(params?: Record<string, unknown>): Promise<void>')
    expect(d).toContain('call(name: "assignNearestTech", order_id: string, trade: string)')
    expect(d).toContain('"allWorkOrders.rowClick"?: (ctx: Ctx, row: Row) => unknown')
    expect(signature(def.logic.functions[0]!)).toBe('(order_id: string)')
  })
})

describe('patch helpers', () => {
  const b = orders.blocks[2]!
  it('creates missing parents', () => {
    const ops = setOps(def, blockPath('orders', b.id), ['style', 'radius'], 12)
    expect(ops).toEqual([{ op: 'add', path: blockPath('orders', b.id, 'style'), value: { radius: 12 } }])
    const next = applyPatch(def, ops)
    expect(setOps(next, blockPath('orders', b.id), ['style', 'radius'], 4)[0]!.op).toBe('replace')
    expect(setOps(next, blockPath('orders', b.id), ['style', 'radius'], undefined)[0]!.op).toBe('remove')
    expect(setOps(def, blockPath('orders', b.id), ['style', 'pad'], undefined)).toEqual([])
  })
})

describe('blocks + viewport', () => {
  it('creates blocks with unique refs and defaults', () => {
    const t = createBlock('table', def, orders)
    expect(t.ref).not.toBe('allWorkOrders')
    expect((t.props as { source: string }).source).toBe('work_orders')
    expect(createBlock('header', def, orders).ref).toBe('pageHeader2')
  })
  it('filters the palette', () => {
    expect(paletteGroups('').length).toBe(5)
    const g = paletteGroups('kpi')
    expect(g.flatMap((x) => x.items.map((i) => i.type))).toEqual(['stats'])
  })
  it('numbers rows from 1', () => {
    expect(rowLabelOf(orders.blocks, orders.blocks[2]!.id)).toBe(3)
  })
  it('fits and steps zoom', () => {
    expect(fitZoom(1440, 840)).toBe(0.55)
    expect(stepZoom(0.55, 1)).toBe(0.67)
    expect(stepZoom(0.55, -1)).toBe(0.5)
  })
})

describe('lifecycle', async () => {
  const { generatedJs, handlerCount, newHandler, withFunction } = await import('../lib/lifecycle')
  it('counts handlers and generates JS', () => {
    expect(handlerCount(orders.lifecycle)).toBe(3)
    const js = generatedJs('onPageReady', orders.lifecycle!.onPageReady!)
    expect(js).toContain("(ctx) => ctx.call('listWorkOrders', { status: ctx.state.filter, cursor: null }),")
    expect(generatedJs('onPageInit', [{ id: 'x', kind: 'code', code: 'ctx.log(1)' }])).toBe(
      'onPageInit: [\n  async (ctx) => {\n    ctx.log(1)\n  },\n],',
    )
  })
  it('keeps matching args when switching functions', () => {
    const fn = def.logic.functions.find((f) => f.name === 'updateOrderStatus')!
    const h = withFunction({ id: 'h', kind: 'function', fn: 'x', args: { status: "'done'" } }, fn)
    expect(h.args).toEqual({ order_id: '', status: "'done'" })
    expect(newHandler('code').kind).toBe('code')
  })
})
