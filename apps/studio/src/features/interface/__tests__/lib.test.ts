import { describe, expect, it } from 'vitest'
import { applyPatch, type AppDefinition, type Block, type Page } from '@platon/definition'
import { fieldopsDefinition, ORDERS_CODE } from '../../../../../../mocks/src/seed'
import { ctxTypings, defaultScript, ensureHandler, parseOutline, signature } from '../lib/script'
import { blockPath, setOps } from '../lib/patch'
import {
  canResize,
  createBlock,
  handleShown,
  layerTree,
  moveAbility,
  moveTarget,
  paletteGroups,
  rowLabelOf,
  spanFromDrag,
} from '../lib/blocks'
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
    expect(paletteGroups('').length).toBe(6)
    const g = paletteGroups('kpi')
    expect(g.flatMap((x) => x.items.map((i) => i.type))).toEqual(['stats', 'kpi'])
    expect(paletteGroups('wrapper').flatMap((x) => x.items.map((i) => i.type))).toEqual(
      expect.arrayContaining(['container', 'grid']),
    )
  })
  it('lists nested blocks as an indented tree in canvas order', () => {
    const blk = (id: string, extra: Partial<Block> = {}): Block => ({
      id,
      type: 'text',
      ref: id,
      row: 0,
      props: {},
      ...extra,
    })
    const blocks = [
      blk('a', { parent: 'g', slot: 1 }),
      blk('g', { type: 'columns', props: { ratio: '1:1' } }),
      blk('b', { parent: 'g', slot: 0 }),
      blk('z', { row: 1 }),
    ]
    expect(layerTree(blocks).map((l) => [l.block.id, l.depth, l.cell])).toEqual([
      ['g', 0, undefined],
      ['b', 1, 'Column 1'],
      ['a', 1, 'Column 2'],
      ['z', 0, undefined],
    ])
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

describe('block toolbar moves', () => {
  const b = (id: string, row: number, extra: Partial<Block> = {}): Block => ({
    id,
    type: 'text',
    ref: id,
    row,
    props: {},
    ...extra,
  })
  // a | (b c) | cols[ x y ]
  const blocks: Block[] = [
    b('a', 0),
    b('b', 1),
    b('c', 1),
    b('cols', 2, { type: 'columns', props: { ratio: '1:1' } }),
    b('x', 0, { parent: 'cols', slot: 0 }),
    b('y', 1, { parent: 'cols', slot: 0 }),
  ]

  it('swaps within a row and steps over neighbouring rows', () => {
    expect(moveTarget(blocks, 'b', 'right')).toEqual({ target: 'c', side: 'right' })
    expect(moveTarget(blocks, 'c', 'left')).toEqual({ target: 'b', side: 'left' })
    expect(moveTarget(blocks, 'a', 'down')).toEqual({ target: 'c', side: 'after' })
    expect(moveTarget(blocks, 'a', 'up')).toBeNull()
  })

  it('leaves a shared row without targeting itself', () => {
    expect(moveTarget(blocks, 'b', 'up')).toEqual({ target: 'c', side: 'before' })
    expect(moveTarget(blocks, 'c', 'down')).toEqual({ target: 'b', side: 'after' })
  })

  it('stays inside the container cell', () => {
    expect(moveAbility(blocks, 'x')).toEqual({ up: false, down: true, left: false, right: false })
    expect(moveTarget(blocks, 'y', 'up')).toEqual({ target: 'x', side: 'before' })
    expect(moveAbility(blocks, 'cols')).toMatchObject({ up: true, down: false })
  })
})

describe('12-column resize', () => {
  const b = (id: string, row: number, extra: Partial<Block> = {}): Block => ({
    id,
    type: 'text',
    ref: id,
    row,
    props: {},
    ...extra,
  })

  it('snaps a dragged edge to whole columns', () => {
    // 1200px row, 16px gaps: a column is 86.67px, a 6-column block is 592px.
    expect(spanFromDrag(592, 6, 0)).toBe(6)
    expect(spanFromDrag(592, 6, 40)).toBe(6)
    expect(spanFromDrag(592, 6, 60)).toBe(7)
    expect(spanFromDrag(592, 6, -250)).toBe(4)
    expect(spanFromDrag(592, 6, 5000)).toBe(12)
    expect(spanFromDrag(592, 6, -5000)).toBe(1)
  })

  it('resizes blocks on the grid, not inside side-by-side containers', () => {
    const blocks = [
      b('a', 0),
      b('stack', 1, { type: 'container', props: { direction: 'row' } }),
      b('in', 0, { parent: 'stack' }),
      b('box', 2, { type: 'container', props: { direction: 'column' } }),
      b('cell', 0, { parent: 'box' }),
    ]
    expect(['a', 'stack', 'in', 'cell', 'nope'].map((id) => canResize(blocks, id))).toEqual([
      true,
      true,
      false,
      true,
      false,
    ])
  })

  it('shows the handle only where the grid is not stacked', () => {
    const rect = { x: 0, y: 0, width: 400, height: 50 }
    // The Sandbox measured the row.
    expect(handleShown(rect, { width: 900, stacked: false }, 2)).toBe(true)
    expect(handleShown(rect, { width: 400, stacked: true }, 2)).toBe(false)
    // A lone full-width block has no grid row around it: the block is the row.
    expect(handleShown({ ...rect, width: 900 }, undefined, 1)).toBe(true)
    expect(handleShown(rect, undefined, 1)).toBe(false)
    // An older Sandbox that does not report the row.
    expect(handleShown(rect, undefined, 2)).toBe(false)
  })
})
