import { describe, expect, it } from 'vitest'
import {
  ancestorIds,
  canPlaceIn,
  cellBlocks,
  columnWeights,
  descendantIds,
  placeBlock,
  slotLabels,
  toRows,
  withCell,
  rowSpans,
  resizeInRow,
  applySpans,
  rowOf,
} from '../src/blocks'
import type { Block } from '../src/generated/app-definition'

const b = (id: string, row: number, extra: Partial<Block> = {}): Block => ({
  id,
  type: 'text',
  ref: id,
  row,
  props: {},
  ...extra,
})
const ids = (rows: Block[][]) => rows.map((r) => r.map((x) => x.id))

describe('containers', () => {
  const page = [
    b('g', 0, { type: 'grid', props: { columns: 2 } }),
    b('a', 0, { parent: 'g', slot: 0 }),
    b('c', 0, { type: 'container', parent: 'g', slot: 1 }),
    b('d', 0, { parent: 'c', slot: 0 }),
    b('z', 1),
  ]

  it('lists the blocks of one cell', () => {
    expect(cellBlocks(page).map((x) => x.id)).toEqual(['g', 'z'])
    expect(cellBlocks(page, 'g', 0).map((x) => x.id)).toEqual(['a'])
    expect(cellBlocks(page, 'g', 1).map((x) => x.id)).toEqual(['c'])
  })

  it('shows children of removed cells in the last cell', () => {
    expect(cellBlocks(page, 'g', 0, 1).map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('walks descendants and ancestors', () => {
    expect([...descendantIds(page, 'g')].sort()).toEqual(['a', 'c', 'd'])
    expect(ancestorIds(page, 'd')).toEqual(['g', 'c'])
  })

  it('refuses to drop a container into itself or its children', () => {
    expect(canPlaceIn(page, 'g', { parent: 'c', slot: 0 })).toBe(false)
    expect(canPlaceIn(page, 'g', { parent: 'g', slot: 0 })).toBe(false)
    expect(canPlaceIn(page, 'a', { parent: 'c', slot: 0 })).toBe(true)
  })

  it('places a block next to a target inside a cell', () => {
    const next = placeBlock(page, b('n', 9), 'a', 'right')
    expect(ids(toRows(cellBlocks(next, 'g', 0)))).toEqual([['a', 'n']])
    expect(next.find((x) => x.id === 'n')).toMatchObject({ parent: 'g', slot: 0, row: 0 })
    // other cells and the page keep their order
    expect(cellBlocks(next).map((x) => x.id)).toEqual(['g', 'z'])
  })

  it('drops into an empty cell and moves out to the page', () => {
    const into = placeBlock(
      page,
      page.find((x) => x.id === 'z')!,
      null,
      'after',
      { parent: 'c', slot: 0 },
    )
    expect(ids(toRows(cellBlocks(into, 'c', 0)))).toEqual([['d'], ['z']])
    const out = placeBlock(
      into,
      into.find((x) => x.id === 'd')!,
      'g',
      'before',
    )
    const d = out.find((x) => x.id === 'd')!
    expect(d.parent).toBeUndefined()
    expect(d.slot).toBeUndefined()
    expect(ids(toRows(cellBlocks(out)))).toEqual([['d'], ['g']])
  })

  it('withCell sets or clears parent and slot', () => {
    expect(withCell(b('x', 0, { parent: 'g', slot: 1 }), {})).toEqual(b('x', 0))
    expect(withCell(b('x', 0), { parent: 'g' })).toMatchObject({ parent: 'g', slot: 0 })
  })

  it('derives cell labels from props', () => {
    expect(slotLabels({ type: 'grid', props: { columns: 3, rows: 2 } })).toHaveLength(6)
    expect(slotLabels({ type: 'columns', props: { ratio: '1:2:1' } })).toEqual([
      'Column 1',
      'Column 2',
      'Column 3',
    ])
    expect(slotLabels({ type: 'tabs', props: { tabs: 'One, Two' } })).toEqual(['One', 'Two'])
    expect(slotLabels({ type: 'text', props: {} })).toEqual([])
    expect(columnWeights('nope')).toEqual([1, 1])
  })
})

describe('12-column rows', () => {
  const b = (id: string, span?: number): Block => ({
    id,
    type: 'text',
    ref: id,
    row: 0,
    props: {},
    ...(span ? { span } : {}),
  })

  it('shares what fixed spans leave among auto blocks', () => {
    expect(rowSpans([b('a')])).toEqual([12])
    expect(rowSpans([b('a'), b('b')])).toEqual([6, 6])
    expect(rowSpans([b('a', 8), b('b')])).toEqual([8, 4])
    expect(rowSpans([b('a', 3), b('b'), b('c')])).toEqual([3, 5, 4])
    expect(rowSpans([b('a', 6)])).toEqual([6])
  })

  it('falls back to equal widths when fixed spans leave no room', () => {
    expect(rowSpans([b('a', 8), b('b', 4), b('c')])).toEqual([4, 4, 4])
    expect(rowSpans([b('a', 10), b('b', 10)])).toEqual([6, 6])
    expect(rowSpans([b('a'), b('b'), b('c'), b('d'), b('e')])).toEqual([3, 3, 2, 2, 2])
  })

  it('resizes one block and keeps every neighbour at least one column', () => {
    const row = [b('a'), b('b'), b('c')]
    expect(resizeInRow(row, 'a', 6)).toEqual(
      new Map([
        ['a', 6],
        ['b', undefined],
        ['c', undefined],
      ]),
    )
    expect(resizeInRow(row, 'a', 12).get('a')).toBe(10)
    expect(resizeInRow([b('a')], 'a', 12).get('a')).toBeUndefined()
  })

  it('drops neighbours fixed spans that no longer fit', () => {
    const row = [b('a', 4), b('b', 8)]
    expect(resizeInRow(row, 'a', 6)).toEqual(
      new Map([
        ['a', 6],
        ['b', undefined],
      ]),
    )
    expect(resizeInRow([b('a', 4), b('b', 4), b('c')], 'a', 6)).toEqual(
      new Map([
        ['a', 6],
        ['b', 4],
        ['c', undefined],
      ]),
    )
  })

  it('applies spans and finds a block row', () => {
    const blocks = [b('a'), { ...b('b'), row: 1 }, { ...b('c'), row: 1 }]
    expect(rowOf(blocks, 'c').map((x) => x.id)).toEqual(['b', 'c'])
    const next = applySpans(
      blocks,
      new Map([
        ['b', 4],
        ['c', undefined],
      ]),
    )
    expect(next[1]!.span).toBe(4)
    expect('span' in next[2]!).toBe(false)
  })
})
