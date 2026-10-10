import { describe, expect, it } from 'vitest'
import { applyPatch, getAt, invertPatch, PatchError, type PatchOp } from '../src/patch'

const doc = () => ({
  logic: {
    apis: [
      { id: 'get_orders', access: { type: 'public' } },
      { id: 'post_orders', access: { type: 'basic' } },
    ],
  },
  tables: [{ id: 't', fields: [{ key: 'a' }, { key: 'b' }] }],
})

describe('id-aware pointers', () => {
  it('resolves array elements by id, key and index', () => {
    expect(getAt(doc(), '/logic/apis/post_orders/access/type')).toBe('basic')
    expect(getAt(doc(), '/tables/t/fields/b')).toEqual({ key: 'b' })
    expect(getAt(doc(), '/logic/apis/0/id')).toBe('get_orders')
    expect(getAt(doc(), '/logic/apis/missing')).toBeUndefined()
  })

  it('replaces by id without mutating the input', () => {
    const before = doc()
    const after = applyPatch(before, [
      { op: 'replace', path: '/logic/apis/post_orders/access/type', value: 'token' },
    ])
    expect(getAt(after, '/logic/apis/post_orders/access/type')).toBe('token')
    expect(getAt(before, '/logic/apis/post_orders/access/type')).toBe('basic')
    // untouched branches are shared
    expect(after.tables).toBe(before.tables)
  })

  it('adds at index, appends with -, and refuses duplicate ids', () => {
    let d = applyPatch(doc(), [{ op: 'add', path: '/logic/apis/0', value: { id: 'first' } }])
    expect(d.logic.apis.map((a) => a.id)).toEqual(['first', 'get_orders', 'post_orders'])
    d = applyPatch(d, [{ op: 'add', path: '/logic/apis/-', value: { id: 'last' } }])
    expect(d.logic.apis.at(-1)?.id).toBe('last')
    expect(() => applyPatch(d, [{ op: 'add', path: '/logic/apis/last', value: { id: 'last' } }])).toThrow(
      PatchError,
    )
  })

  it('moves by id to a position', () => {
    const d = applyPatch(doc(), [{ op: 'move', from: '/logic/apis/post_orders', path: '/logic/apis/0' }])
    expect(d.logic.apis.map((a) => a.id)).toEqual(['post_orders', 'get_orders'])
  })

  it('throws on missing paths and failing tests', () => {
    expect(() => applyPatch(doc(), [{ op: 'remove', path: '/logic/apis/nope' }])).toThrow(PatchError)
    expect(() =>
      applyPatch(doc(), [{ op: 'test', path: '/logic/apis/get_orders/access/type', value: 'x' }]),
    ).toThrow(PatchError)
  })
})

describe('invertPatch', () => {
  const cases: [string, PatchOp[]][] = [
    ['replace', [{ op: 'replace', path: '/logic/apis/post_orders/access/type', value: 'token' }]],
    ['add by index', [{ op: 'add', path: '/logic/apis/1', value: { id: 'mid' } }]],
    ['add new key', [{ op: 'add', path: '/logic/apis/get_orders/cache', value: { enabled: true } }]],
    ['remove', [{ op: 'remove', path: '/logic/apis/get_orders' }]],
    ['move', [{ op: 'move', from: '/tables/t/fields/b', path: '/tables/t/fields/0' }]],
    [
      'sequence',
      [
        { op: 'add', path: '/logic/apis/-', value: { id: 'x' } },
        { op: 'replace', path: '/logic/apis/x/id', value: 'x' },
        { op: 'remove', path: '/tables/t/fields/a' },
      ],
    ],
  ]
  it.each(cases)('round-trips %s', (_, ops) => {
    const before = doc()
    const after = applyPatch(before, ops)
    expect(applyPatch(after, invertPatch(before, ops))).toEqual(before)
  })
})
