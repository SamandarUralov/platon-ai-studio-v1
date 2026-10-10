import { describe, expect, it } from 'vitest'
import type { AppDefinition, Block, Page } from '@platon/definition'
import { fieldopsDefinition, seedRecords } from '../../../mocks/src/seed'
import {
  applyRecordCondition,
  blockRoleAllowed,
  canOpenPage,
  canSeeBlock,
  evalCondition,
  pagePermission,
} from './visibility'
import { filterRows, formatCell, formatDate, tableOf } from './format'
import { STATS } from './stats'
import { forbidden, handlerModule } from './runtime/protocol'
import { appThemeVars } from './theme'
import { monthGrid } from './calendar'

const def: AppDefinition = fieldopsDefinition()
const rows = seedRecords().work_orders!
const orders = tableOf(def, 'work_orders')!
const block = (over: Partial<Block> = {}): Block => ({
  id: 'b1',
  type: 'table',
  ref: 'b1',
  row: 0,
  props: { source: 'work_orders' },
  ...over,
})

describe('visibility', () => {
  const page = { id: 'p', name: 'P', icon: 'x', route: '/p', inMenu: true, blocks: [] } as Page

  it('pages are open to everyone unless visibleTo or permissions say otherwise', () => {
    expect(canOpenPage(page, 'customer')).toBe(true)
    expect(canOpenPage({ ...page, visibleTo: ['admin'] }, 'customer')).toBe(false)
    expect(
      canOpenPage(
        { ...page, permissions: { customer: { view: false, create: false, edit: false, delete: false } } },
        'customer',
      ),
    ).toBe(false)
    expect(canOpenPage({ ...page, visibleTo: ['admin'] }, undefined)).toBe(true)
  })

  it('page permissions default to view-only except for admin', () => {
    expect(pagePermission(page, 'technician', 'edit')).toBe(false)
    expect(pagePermission(page, 'admin', 'delete')).toBe(true)
    expect(
      pagePermission(
        { ...page, permissions: { technician: { view: true, create: false, edit: true, delete: false } } },
        'technician',
        'edit',
      ),
    ).toBe(true)
  })

  it('block roles: undefined = everyone, [] = nobody', () => {
    expect(blockRoleAllowed(block(), 'customer')).toBe(true)
    expect(blockRoleAllowed(block({ visibility: { roles: [] } }), 'admin')).toBe(false)
    expect(blockRoleAllowed(block({ visibility: { roles: ['admin'] } }), 'customer')).toBe(false)
    expect(blockRoleAllowed(block({ visibility: { roles: ['admin'] } }), undefined)).toBe(true)
  })

  it('evaluates conditions', () => {
    expect(evalCondition({ field: 'region', op: 'eq', value: 'north' }, { region: 'North' })).toBe(true)
    expect(evalCondition({ field: 'region', op: 'neq', value: 'North' }, { region: 'North' })).toBe(false)
    expect(evalCondition({ field: 'region', op: 'in', value: 'South, North' }, { region: 'North' })).toBe(
      true,
    )
    expect(evalCondition({ field: 'x', op: 'empty', value: null }, {})).toBe(true)
    expect(evalCondition({ field: 'x', op: 'not_empty', value: null }, { x: [1] })).toBe(true)
  })

  it('record conditions filter rows instead of hiding the block', () => {
    const b = block({ visibility: { condition: { field: 'status', op: 'eq', value: 'Done' } } })
    expect(canSeeBlock(def, b, { role: 'admin', name: 'A' })).toBe(true)
    expect(applyRecordCondition(def, b, rows).every((r) => r.status === 'Done')).toBe(true)
    const v = block({ visibility: { condition: { field: 'region', op: 'eq', value: 'South' } } })
    expect(canSeeBlock(def, v, { role: 'admin', name: 'A', vars: { region: 'North' } })).toBe(false)
  })
})

describe('format', () => {
  it('formats dates and workflow states', () => {
    expect(formatDate('2026-10-06')).toBe('Oct 6')
    const status = orders.fields.find((f) => f.key === 'status')
    expect(formatCell(def, status, 'Waiting on parts')).toEqual({ text: 'Waiting on parts', tone: 'purple' })
    expect(formatCell(def, status, 'done').tone).toBe('ok')
    expect(formatCell(def, undefined, null)).toEqual({ text: '—', muted: true })
  })

  it('filters open records and the viewer’s own', () => {
    expect(filterRows(def, orders, rows, 'open').some((r) => r.status === 'Done')).toBe(false)
    expect(filterRows(def, orders, rows, 'mine', 'Sam Ortiz').every((r) => r.tech === 'Sam Ortiz')).toBe(true)
  })

  it('counts stats', () => {
    const h = { def, today: '2026-10-06' }
    expect(STATS.done!.count(rows, h)).toBe(2)
    expect(STATS.open!.count(rows, h)).toBe(6)
    expect(STATS.today!.count(rows, h)).toBe(2)
  })
})

describe('runtime protocol', () => {
  it('refuses network and DOM access', () => {
    expect(forbidden('ctx.log(1)')).toBeNull()
    expect(forbidden('// fetch is not used here\nctx.log(1)')).toBeNull()
    expect(forbidden('await fetch("/x")')).toMatch(/network/)
    expect(forbidden('document.title = 1')).toMatch(/browser/)
    expect(forbidden("import x from 'y'")).toMatch(/import/)
  })
  it('wraps lifecycle handlers as modules', () => {
    expect(
      handlerModule({
        id: 'h',
        kind: 'function',
        fn: 'listWorkOrders',
        args: { status: 'ctx.state.filter', cursor: '' },
      }),
    ).toContain('ctx.call("listWorkOrders", { "status": (ctx.state.filter), "cursor": (undefined) })')
    expect(handlerModule({ id: 'h', kind: 'code', code: 'ctx.log(1)' })).toContain('ctx.log(1)')
  })
})

describe('theme + calendar', () => {
  it('derives frame variables from the app theme', () => {
    const v = appThemeVars({ color: '#0e7c66', mode: 'dark', radius: 'round' })
    expect(v['--app-accent']).toBe('#0e7c66')
    expect(v['color-scheme']).toBe('dark')
    expect(v['--app-radius']).toBe('16px')
  })
  it('builds a month grid starting on Sunday', () => {
    const g = monthGrid(2026, 9, '2026-10-08')
    expect(g[0]!.iso).toBe('2026-09-27')
    expect(g.find((c) => c.today)?.day).toBe(8)
  })
})
