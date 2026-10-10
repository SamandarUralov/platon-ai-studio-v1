import { describe, expect, it } from 'vitest'
import type { DbConnection, Table } from '@platon/definition'
import { columnName, generateDdl, quote, sqlType, ttlSeconds } from './ddl'

const pg: DbConnection = {
  id: 'main',
  name: 'FieldOps database',
  engine: 'postgres',
  role: 'primary',
  schema: 'public',
}
const customers: Table = {
  id: 'customers',
  name: 'Customers',
  icon: 'building-2',
  connection: 'main',
  fields: [{ key: 'name', name: 'Company', type: 'text', req: true }],
}
const orders: Table = {
  id: 'work_orders',
  name: 'Work orders',
  icon: 'clipboard-list',
  connection: 'main',
  fields: [
    { key: 'ref', name: '#', type: 'auto_number' },
    { key: 'customer', name: 'Customer', type: 'link', req: true, link: 'customers' },
    { key: 'plan', name: 'Plan', type: 'single_select', options: ['Standard', 'Premium'] },
    { key: 'order', name: 'Order', type: 'text', unique: true },
    { key: 'status', name: 'Status', type: 'workflow_state', workflow: 'wo' },
  ],
}
const ctx = { connection: pg, tables: [customers, orders], workflowStates: () => ['New', 'Done'] }

describe('ddl', () => {
  it('maps FIELD_TYPES per dialect', () => {
    expect(sqlType('text', 'postgres')).toBe('VARCHAR(255)')
    expect(sqlType('text', 'mssql')).toBe('NVARCHAR(255)')
    expect(sqlType('checkbox', 'mysql')).toBe('TINYINT(1)')
    expect(sqlType('json', 'mssql')).toBe('NVARCHAR(MAX)')
    expect(sqlType('datetime', 'postgres')).toBe('TIMESTAMPTZ')
  })

  it('names link columns <key>_id and quotes reserved words', () => {
    expect(columnName({ key: 'customer', type: 'link' })).toBe('customer_id')
    expect(quote('order', 'postgres')).toBe('"order"')
    expect(quote('job', 'postgres')).toBe('job')
    expect(quote('job', 'mysql')).toBe('`job`')
    expect(quote('job', 'mssql')).toBe('[job]')
  })

  it('generates PostgreSQL with FK, CHECK, NOT NULL and UNIQUE', () => {
    const { text, language, file } = generateDdl(orders, ctx)
    expect(language).toBe('sql')
    expect(file).toBe('work_orders.sql')
    expect(text).toContain('CREATE TABLE public.work_orders (')
    expect(text).toContain('id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY')
    expect(text).toContain('customer_id BIGINT NOT NULL REFERENCES public.customers (id)')
    expect(text).toContain("CHECK (plan IN ('Standard', 'Premium'))")
    expect(text).toContain("CHECK (status IN ('New', 'Done'))")
    expect(text).toContain('"order" VARCHAR(255) UNIQUE')
    expect(text).not.toContain('CREATE INDEX')
  })

  it('switches dialect and adds indexes & comments', () => {
    const my = generateDdl(orders, { ...ctx, extras: true }, { dialect: 'mysql' }).text
    expect(my).toContain('CREATE TABLE `work_orders` (')
    expect(my).toContain('AUTO_INCREMENT PRIMARY KEY')
    expect(my).toContain('CREATE INDEX `work_orders_customer_id_idx`')
    expect(my).toContain("ALTER TABLE `work_orders` COMMENT = 'Work orders';")
    const ms = generateDdl(orders, ctx, { dialect: 'mssql' }).text
    expect(ms).toContain('CREATE TABLE [dbo].[work_orders] (')
    expect(ms).toContain('[id] BIGINT IDENTITY(1,1) PRIMARY KEY')
    const pgx = generateDdl(orders, { ...ctx, extras: true }).text
    expect(pgx).toContain("COMMENT ON TABLE public.work_orders IS 'Work orders';")
  })

  it('emits a Mongo $jsonSchema', () => {
    const mongo: DbConnection = { ...pg, engine: 'mongo', database: 'app' }
    const { text, language } = generateDdl(orders, { ...ctx, connection: mongo })
    expect(language).toBe('javascript')
    expect(text).toContain('db.createCollection("work_orders"')
    expect(text).toContain('"$jsonSchema"')
    expect(text).toContain('"customer_id"')
    expect(text).toContain('"objectId"')
    const json = text.slice(text.indexOf('{'), text.lastIndexOf(')'))
    expect(JSON.parse(json).validator.$jsonSchema.required).toEqual(['customer_id'])
  })

  it('emits a Redis key pattern with TTL', () => {
    const redis: DbConnection = { ...pg, engine: 'redis' }
    const t: Table = {
      id: 'sessions',
      name: 'Sessions',
      icon: 'key-round',
      connection: 'main',
      ttl: '1 day',
      physicalName: 'fieldops:sessions:{id}',
      fields: [
        { key: 'key', name: 'Key', type: 'text' },
        { key: 'value', name: 'Value', type: 'text' },
      ],
    }
    const { text } = generateDdl(t, { ...ctx, connection: redis }, { appSlug: 'fieldops' })
    expect(text).toContain('# Pattern:  fieldops:sessions:{id}')
    expect(text).toContain('EXPIRE fieldops:sessions:a81f 86400')
    expect(ttlSeconds('15 minutes')).toBe(900)
    expect(ttlSeconds('No expiry')).toBeUndefined()
  })
})
