import { describe, expect, it } from 'vitest'
import { fieldopsDefinition, seedRecords } from '../../../../../../mocks/src/seed'
import { filterByParams, matchRoute, mockCall } from '../mockCall'

const def = fieldopsDefinition()
const rows = seedRecords().work_orders!

describe('preview helpers', () => {
  it('filters loads by workflow state', () => {
    expect(filterByParams(def, 'work_orders', rows, { status: 'open' }).length).toBe(6)
    expect(filterByParams(def, 'work_orders', rows, { status: 'done' }).length).toBe(2)
    expect(filterByParams(def, 'work_orders', rows, { status: 'waiting' }).length).toBe(1)
    expect(filterByParams(def, 'work_orders', rows, undefined).length).toBe(rows.length)
  })
  it('matches routes with params', () => {
    expect(matchRoute('/work-orders/:id', '/work-orders/42')).toEqual({ id: '42' })
    expect(matchRoute('/orders', '/orders/new')).toBeNull()
  })
  it('mocks function results from the return type', () => {
    expect(mockCall(def, 'assignNearestTech')).toMatchObject({ assigned: true, name: 'Sam Ortiz' })
    expect(() => mockCall(def, 'nope')).toThrow(/does not exist/)
  })
})
