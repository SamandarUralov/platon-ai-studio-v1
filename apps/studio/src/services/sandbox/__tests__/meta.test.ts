import { describe, expect, it } from 'vitest'
import type { AppDefinition, Block, Page } from '@platon/definition'
import type { SandboxBlock } from '@platon/bridge/sandbox'
import { fieldopsDefinition, seedRecords } from '../../../../../../mocks/src/seed'
import { ownerBlock, placementOf, rootKey, toSandboxMeta } from '../meta'

const blk = (id: string, type: Block['type'], row: number, extra: Partial<Block> = {}): Block => ({
  id,
  type,
  ref: id,
  row,
  props: {},
  ...extra,
})

// head | (a b) side by side | cols[ left: x ; right: (empty) ] | box[ y ]
const page: Page = {
  id: 'lab',
  name: 'Lab',
  icon: 'flask',
  route: '/lab',
  inMenu: true,
  blocks: [
    blk('head', 'header', 0, { title: 'Lab' }),
    blk('a', 'text', 1, { props: { text: 'A' } }),
    blk('b', 'text', 1, { props: { text: 'B' }, visibility: { roles: [] } }),
    blk('cols', 'columns', 2, { props: { ratio: '1:1' } }),
    blk('x', 'button', 0, { parent: 'cols', slot: 0, props: { label: 'Go' } }),
    blk('box', 'container', 3, { props: { variant: 'card' } }),
    blk('y', 'kpi', 0, { parent: 'box', title: 'Jobs', props: { source: 'work_orders' } }),
  ],
}

function lab(): AppDefinition {
  const def = fieldopsDefinition()
  return { ...def, interface: { ...def.interface, pages: [...def.interface.pages, page] } }
}

const records = seedRecords()
const { meta, nodes } = toSandboxMeta(lab(), { records })
const tree = meta.pages.find((p) => p.id === 'lab')!.blocks
const find = (id: string, list: SandboxBlock[] = tree): SandboxBlock | undefined => {
  for (const b of list) {
    if (b.id === id) return b
    const hit = find(id, b.children ?? [])
    if (hit) return hit
  }
}

describe('toSandboxMeta', () => {
  it('turns flat rows and container cells into a tree', () => {
    expect(tree.map((b) => b.component)).toEqual(['page_header', 'row', 'row', 'card'])
    expect(tree[1]!.children!.map((b) => b.id)).toEqual(['a', 'b'])
    expect(find('cols')!.children!.map((c) => c.component)).toEqual(['column', 'column'])
    expect(find('cols~0')!.children!.map((c) => c.id)).toEqual(['x'])
    expect(find('cols~1')!.children).toEqual([])
    expect(find('box')!.children!.map((c) => c.id)).toEqual(['y'])
  })

  it('maps block props onto Sandbox components', () => {
    expect(find('head')).toMatchObject({ component: 'page_header', props: { title: 'Lab' } })
    expect(find('x')).toMatchObject({ component: 'button', props: { label: 'Go' } })
    expect(find('y')).toMatchObject({
      component: 'numbers',
      props: { label: 'Jobs', value: records.work_orders!.length },
    })
  })

  it('sends tabs/accordion as one column per panel and other types under their own name', () => {
    const extra: Page = {
      ...page,
      id: 'more',
      route: '/more',
      blocks: [
        blk('tb', 'tabs', 0, { props: { tabs: ['One', 'Two'], position: 'top' } }),
        blk('t1', 'text', 0, { parent: 'tb', slot: 1, props: { text: 'In two' } }),
        blk('ch', 'bar', 1, { title: 'By status', props: { source: 'work_orders', groupBy: 'status' } }),
        blk('bd', 'badge', 2, { props: { text: 'New', variant: 'primary' } }),
      ],
    }
    const def = lab()
    const built = toSandboxMeta({ ...def, interface: { ...def.interface, pages: [extra] } }, { records })
    const list = built.meta.pages[0]!.blocks
    const tb = list[0]!
    expect(tb).toMatchObject({ component: 'tabs', props: { tabs: ['One', 'Two'], position: 'top' } })
    expect(tb.children!.map((c) => [c.id, c.component])).toEqual([
      ['tb~0', 'column'],
      ['tb~1', 'column'],
    ])
    expect(tb.children![1]!.children!.map((c) => c.id)).toEqual(['t1'])
    expect(placementOf(built.nodes, 'more', 'tb~0', 0)).toEqual({
      target: null,
      side: 'after',
      cell: { parent: 'tb', slot: 0 },
    })
    expect(list[1]).toMatchObject({
      component: 'bar',
      props: { title: 'By status', groupBy: 'status' },
      query: { table: 'work_orders' },
    })
    expect(list[2]).toMatchObject({ component: 'badge', props: { text: 'New', variant: 'primary' } })
    expect(list[2]!.query).toBeUndefined()
  })

  it('keeps "visible to nobody" hidden (the Sandbox reads [] as everyone)', () => {
    expect(find('b')!.visible_to).toEqual(['~nobody'])
    expect(find('a')!.visible_to).toBeUndefined()
  })

  it('seeds data models with Development records and lists menu pages', () => {
    expect(meta.data_models.find((m) => m.table === 'work_orders')!.seed).toBe(records.work_orders)
    expect(meta.menu.some((m) => m.page === 'lab')).toBe(true)
    expect(meta.roles).toEqual(lab().roles.map((r) => r.id))
  })
})

describe('Sandbox locations → definition', () => {
  it('maps the page root', () => {
    expect(placementOf(nodes, 'lab', null, 0)).toEqual({ target: 'head', side: 'before', cell: {} })
    // index 1 is the synthetic row: insert before its first block
    expect(placementOf(nodes, 'lab', null, 1)).toEqual({ target: 'a', side: 'before', cell: {} })
    expect(placementOf(nodes, 'lab', null, 4)).toEqual({ target: null, side: 'after', cell: {} })
  })

  it('maps a synthetic row to left/right of its blocks', () => {
    const row = tree[1]!.id
    expect(placementOf(nodes, 'lab', row, 1)).toEqual({ target: 'b', side: 'left', cell: {} })
    expect(placementOf(nodes, 'lab', row, 2)).toEqual({ target: 'b', side: 'right', cell: {} })
  })

  it('maps container cells', () => {
    expect(placementOf(nodes, 'lab', 'cols~1', 0)).toEqual({
      target: null,
      side: 'after',
      cell: { parent: 'cols', slot: 1 },
    })
    expect(placementOf(nodes, 'lab', 'cols', 5)).toEqual({
      target: null,
      side: 'after',
      cell: { parent: 'cols', slot: 1 },
    })
    expect(placementOf(nodes, 'lab', 'box', 0)).toEqual({
      target: 'y',
      side: 'before',
      cell: { parent: 'box', slot: 0 },
    })
  })

  it('returns null for unknown nodes', () => {
    expect(placementOf(nodes, 'lab', 'nope', 0)).toBeNull()
    expect(nodes.has(rootKey('lab'))).toBe(true)
  })

  it('resolves selections to their definition block', () => {
    expect(ownerBlock(nodes, 'a')).toBe('a')
    expect(ownerBlock(nodes, 'cols~0')).toBe('cols')
    expect(ownerBlock(nodes, tree[1]!.id)).toBeNull()
    expect(ownerBlock(nodes, null)).toBeNull()
  })
})
