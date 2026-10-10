import { describe, expect, it } from 'vitest'
import { applyPatch, type AppDefinition, type DbConnection, type Table } from '@platon/definition'
import {
  addFieldChange,
  changeTypeChange,
  detachConnectionChange,
  moveFieldChange,
  newFieldKey,
  physicalNameOf,
  relationsIn,
  relationsOut,
  setCredentialChange,
  setFieldPropChange,
  toCsv,
} from './model'

const conn: DbConnection = { id: 'main', name: 'Main', engine: 'postgres', role: 'primary' }
const customers: Table = {
  id: 'customers',
  name: 'Customers',
  icon: 'x',
  connection: 'main',
  fields: [{ key: 'name', name: 'Name', type: 'text' }],
}
const orders: Table = {
  id: 'orders',
  name: 'Orders',
  icon: 'x',
  connection: 'main',
  fields: [
    { key: 'ref', name: '#', type: 'auto_number' },
    { key: 'customer', name: 'Customer', type: 'link', link: 'customers', req: true },
    { key: 'plan', name: 'Plan', type: 'single_select', options: ['A', 'B'] },
  ],
}
const def = { data: { connections: [conn], tables: [customers, orders] } } as unknown as AppDefinition
const run = (ops: Parameters<typeof applyPatch>[1]) => applyPatch(def, ops)

describe('data model', () => {
  it('derives physical names per engine', () => {
    expect(physicalNameOf({ engine: 'postgres' }, 'Work orders', 'x')).toBe('public.work_orders')
    expect(physicalNameOf({ engine: 'redis' }, 'Tech sessions', 'FieldOps')).toBe(
      'fieldops:tech_sessions:{id}',
    )
    expect(physicalNameOf({ engine: 'mongo', database: 'app' }, 'Logs', 'x')).toBe('app.logs')
  })

  it('derives FK out/in from link fields', () => {
    const out = relationsOut(orders, [customers, orders])
    expect(out).toHaveLength(1)
    expect(out[0]!.constraint).toBe('fk_orders_customer_id')
    expect(out[0]!.onDelete).toBe('RESTRICT')
    expect(relationsIn(customers, [customers, orders]).map((r) => r.fromTable.id)).toEqual(['orders'])
  })

  it('writes CSV with escaping', () => {
    expect(
      toCsv(
        [
          { key: 'a', name: 'A' },
          { key: 'b', name: 'B, b' },
        ],
        [{ a: 'x"y', b: 1 }, { a: null }],
      ),
    ).toBe('A,"B, b"\r\n"x""y",1\r\n,')
  })

  it('builds field changes that apply cleanly', () => {
    expect(newFieldKey('Plan', orders)).toBe('plan2')
    let d = run(addFieldChange(orders, { key: 'notes', name: 'Notes', type: 'long_text' }).ops)
    expect(d.data.tables[1]!.fields.at(-1)!.key).toBe('notes')
    d = run(setFieldPropChange(orders, orders.fields[2]!, 'req', true).ops)
    expect(d.data.tables[1]!.fields[2]!.req).toBe(true)
    d = run(setFieldPropChange(orders, orders.fields[1]!, 'req', false).ops)
    expect(d.data.tables[1]!.fields[1]!.req).toBeUndefined()
    d = run(changeTypeChange(orders, orders.fields[2]!, 'text').ops)
    expect(d.data.tables[1]!.fields[2]).toEqual({ key: 'plan', name: 'Plan', type: 'text' })
    d = run(moveFieldChange(orders, orders.fields[2]!, 0).ops)
    expect(d.data.tables[1]!.fields.map((f) => f.key)).toEqual(['plan', 'ref', 'customer'])
  })

  it('sets credentials and detaches with tables', () => {
    let d = run(setCredentialChange(conn, 'staging', 'secret://main/staging').ops)
    expect(d.data.connections[0]!.credentials).toEqual({ staging: 'secret://main/staging' })
    d = run(detachConnectionChange(conn, [customers, orders]).ops)
    expect(d.data.connections).toHaveLength(0)
    expect(d.data.tables).toHaveLength(0)
  })
})
