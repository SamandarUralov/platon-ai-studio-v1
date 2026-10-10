import { describe, expect, it } from 'vitest'
import { fieldopsDefinition } from '@platon/mocks/seed'
import { buildDefinitionTree, filterTree, trail } from '../definitionTree'
import { jsonLines } from '../jsonLines'
import { changePointer, linkForPointer } from '@/composables/definitionLinks'

const def = fieldopsDefinition()

describe('definition tree', () => {
  const tree = buildDefinitionTree(def)
  it('has the six sections with pointer ids', () => {
    expect(tree.map((n) => n.id)).toEqual([
      '/interface',
      '/logic',
      '/data',
      '/storage',
      '/workflows',
      '/settings',
    ])
    expect(trail(tree, '/data/tables/work_orders').map((n) => n.label)).toEqual([
      'Data',
      'Tables',
      'Work orders',
    ])
  })
  it('filters and keeps ancestors', () => {
    const f = filterTree(tree, 'work orders')
    expect(f.map((n) => n.id)).toContain('/data')
    expect(trail(f, '/data/tables/work_orders')).toHaveLength(3)
    expect(filterTree(tree, 'zzzz')).toEqual([])
  })
})

describe('jsonLines', () => {
  it('tracks pointers by element id', () => {
    const { lines } = jsonLines({ fields: [{ key: 'a', n: 1 }] }, '/data/tables/t')
    expect(lines.map((l) => l.text)).toEqual(['{', '[', '{', '"a"', '1', '}', ']', '}'])
    expect(lines.find((l) => l.key === 'n')!.pointer).toBe('/data/tables/t/fields/a/n')
    expect(lines.find((l) => l.key === 'key')!.comma).toBe(true)
  })
})

describe('linkForPointer', () => {
  it('maps pointers to Studio screens', () => {
    expect(linkForPointer('p', '/interface/pages/orders/blocks/o3', def)!.to).toMatchObject({
      name: 'interface',
      params: { pageId: 'orders' },
    })
    expect(linkForPointer('p', '/logic/apis/parts_webhook/steps/s74', def)!.to).toMatchObject({
      name: 'logic',
      params: { kind: 'apis', itemId: 'parts_webhook' },
    })
    expect(linkForPointer('p', '/data/tables/work_orders/fields', def)!.to).toMatchObject({
      name: 'data',
      params: { connId: 'main', tableId: 'work_orders' },
    })
    expect(linkForPointer('p', '/storage/local/folders/uploads', def)!.to).toMatchObject({
      name: 'storage',
      params: { kind: 'local', itemId: 'uploads' },
    })
    expect(linkForPointer('p', '/workflows/work_order', def)!.to).toMatchObject({
      name: 'settings',
      params: { section: 'workflows' },
    })
    expect(linkForPointer('p', '/interface/pages/0', def)!.to).toMatchObject({
      params: { pageId: def.interface.pages[0]!.id },
    })
  })
  it('derives a change pointer from ops or key', () => {
    expect(changePointer({ key: 'x', ops: [{ op: 'add', path: '/data/tables/-' }] })).toBe('/data/tables')
    expect(changePointer({ key: 'workflows.work_order.states', ops: [] })).toBe(
      '/workflows/work_order/states',
    )
  })
})
