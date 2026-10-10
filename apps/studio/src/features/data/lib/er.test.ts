import { describe, expect, it } from 'vitest'
import type { Table } from '@platon/definition'
import { canvasSize, edgePath, elkLayout, ER, erEdges, gridLayout, mergePositions, nodeHeight } from './er'

const t = (id: string, links: string[] = [], extra = 0): Table => ({
  id,
  name: id,
  icon: 'table-2',
  connection: 'main',
  fields: [
    ...links.map((l) => ({ key: `${l}_ref`, name: l, type: 'link' as const, link: l })),
    ...Array.from({ length: extra }, (_, i) => ({ key: `f${i}`, name: `F${i}`, type: 'text' as const })),
  ],
})

const tables = [
  t('customers', [], 3),
  t('work_orders', ['customers', 'technicians', 'elsewhere']),
  t('technicians', [], 2),
  t('parts', ['work_orders']),
]

describe('er', () => {
  it('derives edges only between tables on the canvas', () => {
    const e = erEdges(tables)
    expect(e.map((x) => `${x.from}->${x.to}`)).toEqual([
      'work_orders->customers',
      'work_orders->technicians',
      'parts->work_orders',
    ])
    expect(e[1]!.fieldRow).toBe(2)
  })

  it('packs a grid without overlaps', () => {
    const pos = gridLayout(tables, 2)
    expect(pos.customers).toEqual({ x: ER.pad, y: ER.pad })
    expect(pos.technicians!.y).toBe(ER.pad + nodeHeight(tables[0]!) + ER.gapY)
    expect(pos.work_orders!.x).toBe(ER.pad + ER.width + ER.gapX)
  })

  it('keeps saved positions and drops removed tables', () => {
    const merged = mergePositions(
      tables.slice(0, 2),
      { customers: { x: 500, y: 9 }, gone: { x: 1, y: 1 } },
      gridLayout(tables),
    )
    expect(merged).toEqual({ customers: { x: 500, y: 9 }, work_orders: gridLayout(tables).work_orders })
  })

  it('draws edges from the field row to the target header', () => {
    const pos = { a: { x: 0, y: 0 }, b: { x: 400, y: 100 } }
    const p = edgePath({ id: 'a.x', from: 'a', fieldKey: 'x', fieldRow: 1, to: 'b' }, pos, 'b')!
    expect(p.from).toEqual({ x: ER.width, y: ER.head + ER.row + ER.row / 2 })
    expect(p.to).toEqual({ x: 400, y: 100 + ER.head / 2 })
    expect(p.hot).toBe(true)
    expect(canvasSize(tables, gridLayout(tables)).w).toBeGreaterThan(ER.width)
  })

  it('auto-arranges with ELK: referenced tables left of referencing ones', async () => {
    const pos = await elkLayout(tables)
    expect(Object.keys(pos).sort()).toEqual(['customers', 'parts', 'technicians', 'work_orders'])
    expect(pos.customers!.x).toBeLessThan(pos.work_orders!.x)
    expect(pos.work_orders!.x).toBeLessThan(pos.parts!.x)
  })
})
