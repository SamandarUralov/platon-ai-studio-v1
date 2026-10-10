import { describe, expect, it } from 'vitest'
import { fieldopsDefinition, seedRecords } from './index'
import { generateRows, parseSelect, runSelect, SqlError } from './data'

const def = fieldopsDefinition()
const tables = def.data.tables
const records = seedRecords()
const q = (sql: string) => runSelect(sql, tables, records)

describe('mock SQL engine', () => {
  it('selects columns with WHERE and LIMIT', () => {
    const r = q("SELECT ref, job FROM work_orders WHERE status = 'Done' LIMIT 1")
    expect(r.columns).toEqual(['ref', 'job'])
    expect(r.rows).toEqual([['WO-1047', 'Boiler pressure fault']])
    expect(r.rowCount).toBe(1)
  })

  it('supports *, schema-qualified names, !=, ORDER BY and LIKE', () => {
    expect(q('select * from public.customers').columns).toEqual(['id', 'name', 'contact', 'city', 'plan'])
    const open = q("SELECT ref, due FROM work_orders WHERE status != 'Done' ORDER BY due DESC, ref")
    expect(open.rowCount).toBe(6)
    expect(open.rows[0]).toEqual(['WO-1049', '2026-10-10'])
    expect(q("SELECT name FROM customers WHERE city LIKE 's%' ORDER BY name").rows).toEqual([
      ['Cedar Schools'],
      ['Lumen Data'],
    ])
  })

  it('groups and counts', () => {
    const r = q('SELECT tech, COUNT(*) AS jobs FROM work_orders GROUP BY tech ORDER BY jobs DESC, tech')
    expect(r.columns).toEqual(['tech', 'jobs'])
    expect(r.rows[0]).toEqual(['Sam Ortiz', 3])
    expect(q('SELECT COUNT(*) FROM customers').rows).toEqual([[5]])
  })

  it('accepts <link>_id columns and numeric comparison', () => {
    expect(q("SELECT ref FROM work_orders WHERE customer_id = 'Harbor Foods' AND hours > 2").rows).toEqual([
      ['WO-1043'],
    ])
  })

  it('reports database-style errors', () => {
    expect(() => q('SELECT x FROM nope')).toThrow('relation "nope" does not exist')
    expect(() => q('SELECT nope FROM customers')).toThrow('column "nope" does not exist')
    expect(() => q('DROP TABLE customers')).toThrow(SqlError)
    expect(() => parseSelect("SELECT a FROM b WHERE c = 'x")).toThrow('Unterminated')
    expect(() => q('SELECT name, city FROM customers GROUP BY city')).toThrow('GROUP BY')
  })
})

describe('test data', () => {
  it('fills every field and links to existing rows', () => {
    const t = tables.find((x) => x.id === 'work_orders')!
    const rows = generateRows(t, def, records, 5)
    expect(rows).toHaveLength(5)
    for (const r of rows) {
      expect(r._test).toBe(true)
      expect(records.customers!.map((c) => c.name)).toContain(r.customer)
      expect(String(r.ref)).toMatch(/^WO-\d+$/)
    }
    expect(rows[0]!.ref).toBe('WO-1050')
    expect(rows[1]!.ref).toBe('WO-1051')
  })
})
