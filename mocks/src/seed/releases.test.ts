import { describe, expect, it } from 'vitest'
import type { DataLayer, StorageLayer } from '@platon/definition'
import {
  demoSchemaChanges,
  generateMigrations,
  generateProvisioning,
  nextReleaseName,
  snapshotOf,
} from './releases'
import { fieldopsDefinition } from './fieldops'

const data = (): DataLayer => ({
  connections: [
    { id: 'main', name: 'Main', engine: 'postgres', role: 'primary' },
    { id: 'cache', name: 'Cache', engine: 'redis', role: 'cache' },
  ],
  tables: [
    {
      id: 'work_orders',
      name: 'Work orders',
      icon: 'x',
      connection: 'main',
      fields: [
        { key: 'ref', name: '#', type: 'auto_number' },
        { key: 'job', name: 'Job', type: 'text', req: true },
        { key: 'hours', name: 'Hours', type: 'number' },
      ],
    },
    {
      id: 'sessions',
      name: 'Sessions',
      icon: 'x',
      connection: 'cache',
      fields: [{ key: 'key', name: 'Key', type: 'text' }],
    },
  ],
})

describe('generateMigrations', () => {
  it('returns nothing when the schema is unchanged', () => {
    expect(generateMigrations(data(), data(), 143)).toEqual([])
  })

  it('adds a column with a Flyway-style name', () => {
    const after = data()
    after.tables[0]!.fields.push({ key: 'priority', name: 'Priority', type: 'single_select' })
    const [m, ...rest] = generateMigrations(data(), after, 143)
    expect(rest).toHaveLength(0)
    expect(m!.file).toBe('V143__add_priority_to_work_orders.sql')
    expect(m!.sql).toBe('ALTER TABLE "work_orders" ADD COLUMN "priority" VARCHAR(64);')
    expect(m!.destructive).toBeUndefined()
  })

  it('keeps new required columns nullable for existing rows', () => {
    const after = data()
    after.tables[0]!.fields.push({ key: 'site', name: 'Site', type: 'text', req: true })
    const m = generateMigrations(data(), after, 1)[0]!
    expect(m.sql).toContain('ADD COLUMN "site" VARCHAR(255);')
    expect(m.sql).toContain('existing rows keep NULL')
  })

  it('creates and drops tables, marks drops destructive, numbers sequentially', () => {
    const after = data()
    after.tables = after.tables.filter((t) => t.id !== 'work_orders')
    after.tables.push({
      id: 'invoices',
      name: 'Invoices',
      icon: 'x',
      connection: 'main',
      fields: [{ key: 'total', name: 'Total', type: 'currency', req: true }],
    })
    const ms = generateMigrations(data(), after, 10)
    expect(ms.map((m) => m.file)).toEqual(['V10__create_invoices.sql', 'V11__drop_work_orders.sql'])
    expect(ms[0]!.sql).toContain('"id" BIGSERIAL PRIMARY KEY')
    expect(ms[0]!.sql).toContain('"total" NUMERIC(12,2) NOT NULL')
    expect(ms[1]!.destructive).toBe(true)
  })

  it('handles type, required and dropped-column changes in one migration', () => {
    const after = data()
    const t = after.tables[0]!
    t.fields = [t.fields[0]!, { ...t.fields[1]!, req: false }, { ...t.fields[2]!, type: 'text' }]
    t.fields.pop()
    const ms = generateMigrations(data(), after, 5)
    expect(ms).toHaveLength(1)
    expect(ms[0]!.sql).toContain('ALTER COLUMN "job" DROP NOT NULL')
    expect(ms[0]!.sql).toContain('DROP COLUMN "hours"')
    expect(ms[0]!.destructive).toBe(true)
  })

  it('ignores schemaless stores', () => {
    const after = data()
    after.tables[1]!.fields.push({ key: 'ttl', name: 'TTL', type: 'text' })
    expect(generateMigrations(data(), after, 1)).toEqual([])
  })

  it('turns the FieldOps demo edit into V143__add_priority_to_work_orders.sql', () => {
    const def = fieldopsDefinition()
    const after = demoSchemaChanges().apply(def)
    const ms = generateMigrations(snapshotOf(def).data, after.data, 143)
    expect(ms.map((m) => m.file)).toEqual(['V143__add_priority_to_work_orders.sql'])
    const prov = generateProvisioning(def.storage, after.storage)
    expect(prov).toEqual([
      expect.objectContaining({
        kind: 'bucket',
        action: 'create',
        target: 'field_files / fieldops-signatures',
      }),
    ])
  })
})

describe('generateProvisioning', () => {
  const storage = (): StorageLayer => ({
    object: [
      {
        id: 's3',
        name: 'Files',
        provider: 'minio',
        endpoint: 'x',
        buckets: [{ name: 'a', access: 'private', versioning: false }],
      },
    ],
    local: { root: '/r', folders: [{ id: 'up', path: 'uploads', quota: '1 GB', access: 'rw' }] },
  })
  it('creates, updates and removes buckets and folders', () => {
    const after = storage()
    after.object[0]!.buckets = [
      { name: 'a', access: 'signed', versioning: false },
      { name: 'b', access: 'private', versioning: true },
    ]
    after.local.folders = [{ id: 'tmp', path: 'tmp', quota: '1 GB', access: 'rw' }]
    const steps = generateProvisioning(storage(), after).map((s) => `${s.action}:${s.kind}:${s.target}`)
    expect(steps).toEqual([
      'update:bucket:s3 / a',
      'create:bucket:s3 / b',
      'create:folder:tmp',
      'remove:folder:uploads',
    ])
  })
})

describe('nextReleaseName', () => {
  it('bumps the highest minor version', () => {
    expect(nextReleaseName(['v1.2', 'v1.4', 'v1.3'])).toBe('v1.5')
    expect(nextReleaseName(['hotfix', 'v2.10'])).toBe('v2.11')
    expect(nextReleaseName([])).toBe('v1.0')
  })
})
