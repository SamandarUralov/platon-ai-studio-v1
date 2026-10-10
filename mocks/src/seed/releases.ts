/**
 * Release engine for the mock backend: migrations and storage provisioning are generated from a
 * schema diff between the last released definition and the working copy (what the Release
 * service does server-side). Also seeds release history and the logic test catalogue.
 */
import {
  ENGINES,
  FIELD_TYPES,
  type AppDefinition,
  type Change,
  type DataLayer,
  type Migration,
  type ProvisioningStep,
  type StorageLayer,
  type Table,
  type TableField,
  type TestCase,
} from '@platon/definition'

/** The parts of the definition a release turns into migrations / provisioning. */
export interface SchemaSnapshot {
  data: DataLayer
  storage: StorageLayer
}

export function snapshotOf(def: Pick<AppDefinition, 'data' | 'storage'>): SchemaSnapshot {
  return structuredClone({ data: def.data, storage: def.storage })
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)

const tableName = (t: Table) => t.physicalName ?? t.id
const q = (id: string) => `"${id.replace(/"/g, '""')}"`

function columnSql(f: TableField): string {
  let sql = `${q(f.key)} ${FIELD_TYPES[f.type]?.sql ?? 'TEXT'}`
  if (f.req && f.type !== 'auto_number') sql += ' NOT NULL'
  if (f.unique) sql += ' UNIQUE'
  return sql
}

function isSqlTable(data: DataLayer, t: Table): boolean {
  const conn = data.connections.find((c) => c.id === t.connection)
  return !!conn && ENGINES[conn.engine]?.sql === true
}

interface Draft {
  name: string
  connection: string
  summary: string
  lines: string[]
  destructive?: boolean
}

/**
 * Diff the SQL tables of two data layers into ordered, numbered migrations.
 * One migration per table touched, named after its first change (Flyway style `V<n>__<what>.sql`).
 * Non-SQL stores (Redis, Mongo) are schemaless and produce no migrations.
 */
export function generateMigrations(before: DataLayer, after: DataLayer, firstNumber: number): Migration[] {
  const drafts: Draft[] = []
  const prev = new Map(before.tables.filter((t) => isSqlTable(before, t)).map((t) => [t.id, t]))
  const next = new Map(after.tables.filter((t) => isSqlTable(after, t)).map((t) => [t.id, t]))

  for (const [id, t] of next) {
    const old = prev.get(id)
    const name = tableName(t)
    if (!old) {
      const cols = t.fields.map((f) => `  ${columnSql(f)}`)
      const hasId = t.fields.some((f) => f.key === 'id')
      drafts.push({
        name: `create_${slug(name)}`,
        connection: t.connection,
        summary: `Create table “${t.name}” with ${t.fields.length} field${t.fields.length === 1 ? '' : 's'}`,
        lines: [
          `CREATE TABLE ${q(name)} (`,
          [...(hasId ? [] : ['  "id" BIGSERIAL PRIMARY KEY']), ...cols].join(',\n'),
          ');',
        ],
      })
      continue
    }
    const lines: string[] = []
    const parts: string[] = []
    let destructive = false
    const oldFields = new Map(old.fields.map((f) => [f.key, f]))
    const newFields = new Map(t.fields.map((f) => [f.key, f]))
    for (const f of t.fields) {
      const o = oldFields.get(f.key)
      if (!o) {
        // A required column on a table with rows needs a default first; leave it nullable and say so.
        const col = columnSql({ ...f, req: false })
        lines.push(`ALTER TABLE ${q(name)} ADD COLUMN ${col};`)
        if (f.req)
          lines.push(`-- “${f.name}” is required for new records; existing rows keep NULL until edited.`)
        parts.push(`add_${slug(f.key)}_to_${slug(name)}`)
        continue
      }
      if (o.type !== f.type) {
        lines.push(
          `ALTER TABLE ${q(name)} ALTER COLUMN ${q(f.key)} TYPE ${FIELD_TYPES[f.type]?.sql ?? 'TEXT'} USING ${q(f.key)}::${FIELD_TYPES[f.type]?.sql ?? 'TEXT'};`,
        )
        parts.push(`change_${slug(f.key)}_type_in_${slug(name)}`)
      }
      if (!!o.req !== !!f.req && f.type !== 'auto_number') {
        lines.push(`ALTER TABLE ${q(name)} ALTER COLUMN ${q(f.key)} ${f.req ? 'SET' : 'DROP'} NOT NULL;`)
        parts.push(`${f.req ? 'require' : 'unrequire'}_${slug(f.key)}_in_${slug(name)}`)
      }
      if (!!o.unique !== !!f.unique) {
        const c = q(`${name}_${f.key}_key`)
        lines.push(
          f.unique
            ? `ALTER TABLE ${q(name)} ADD CONSTRAINT ${c} UNIQUE (${q(f.key)});`
            : `ALTER TABLE ${q(name)} DROP CONSTRAINT ${c};`,
        )
        parts.push(`${f.unique ? 'unique' : 'drop_unique'}_${slug(f.key)}_in_${slug(name)}`)
      }
    }
    for (const o of old.fields) {
      if (newFields.has(o.key)) continue
      lines.push(`ALTER TABLE ${q(name)} DROP COLUMN ${q(o.key)};`)
      parts.push(`drop_${slug(o.key)}_from_${slug(name)}`)
      destructive = true
    }
    if (tableName(old) !== name) {
      lines.unshift(`ALTER TABLE ${q(tableName(old))} RENAME TO ${q(name)};`)
      parts.unshift(`rename_${slug(tableName(old))}_to_${slug(name)}`)
    }
    if (lines.length)
      drafts.push({
        name: parts[0]!,
        connection: t.connection,
        summary: `${t.name}: ${parts.length} change${parts.length === 1 ? '' : 's'}`,
        lines,
        destructive,
      })
  }
  for (const [id, t] of prev) {
    if (next.has(id)) continue
    drafts.push({
      name: `drop_${slug(tableName(t))}`,
      connection: t.connection,
      summary: `Drop table “${t.name}”`,
      lines: [`DROP TABLE ${q(tableName(t))};`],
      destructive: true,
    })
  }
  return drafts.map((d, i) => ({
    file: `V${firstNumber + i}__${d.name}.sql`,
    connection: d.connection,
    summary: d.summary,
    sql: d.lines.join('\n'),
    ...(d.destructive ? { destructive: true } : {}),
  }))
}

/** Object storages, buckets and local folders to create/update/remove in the target environment. */
export function generateProvisioning(before: StorageLayer, after: StorageLayer): ProvisioningStep[] {
  const out: ProvisioningStep[] = []
  const prevS = new Map(before.object.map((s) => [s.id, s]))
  for (const s of after.object) {
    const o = prevS.get(s.id)
    if (!o)
      out.push({
        kind: 'object_storage',
        action: 'create',
        target: s.id,
        summary: `Connect object storage “${s.name}” (${s.provider})`,
      })
    const oldBuckets = new Map((o?.buckets ?? []).map((b) => [b.name, b]))
    for (const b of s.buckets) {
      const ob = oldBuckets.get(b.name)
      if (!ob)
        out.push({
          kind: 'bucket',
          action: 'create',
          target: `${s.id} / ${b.name}`,
          summary: `Create bucket ${b.name} · ${b.access}${b.versioning ? ' · versioned' : ''}`,
        })
      else if (ob.access !== b.access || ob.versioning !== b.versioning)
        out.push({
          kind: 'bucket',
          action: 'update',
          target: `${s.id} / ${b.name}`,
          summary: `Update bucket ${b.name} policy · ${b.access}${b.versioning ? ' · versioned' : ''}`,
        })
    }
    for (const ob of o?.buckets ?? [])
      if (!s.buckets.some((b) => b.name === ob.name))
        out.push({
          kind: 'bucket',
          action: 'remove',
          target: `${s.id} / ${ob.name}`,
          summary: `Detach bucket ${ob.name} (files are kept in the bucket)`,
        })
  }
  for (const o of before.object)
    if (!after.object.some((s) => s.id === o.id))
      out.push({
        kind: 'object_storage',
        action: 'remove',
        target: o.id,
        summary: `Disconnect object storage “${o.name}” (files are kept)`,
      })

  const prevF = new Map(before.local.folders.map((f) => [f.id, f]))
  for (const f of after.local.folders) {
    const o = prevF.get(f.id)
    if (!o)
      out.push({
        kind: 'folder',
        action: 'create',
        target: f.path,
        summary: `Create folder ${after.local.root}/${f.path} · ${f.quota} · ${f.access}`,
      })
    else if (o.quota !== f.quota || o.access !== f.access || o.cleanup !== f.cleanup || o.path !== f.path)
      out.push({
        kind: 'folder',
        action: 'update',
        target: f.path,
        summary: `Update folder ${f.path} · ${f.quota} · ${f.access}${f.cleanup ? ` · cleanup ${f.cleanup}` : ''}`,
      })
  }
  for (const o of before.local.folders)
    if (!after.local.folders.some((f) => f.id === o.id))
      out.push({
        kind: 'folder',
        action: 'remove',
        target: o.path,
        summary: `Stop managing folder ${o.path} (files are kept)`,
      })
  return out
}

export function nextReleaseName(names: string[]): string {
  let best: [number, number] | null = null
  for (const n of names) {
    const m = /^v?(\d+)\.(\d+)/.exec(n)
    if (!m) continue
    const v: [number, number] = [Number(m[1]), Number(m[2])]
    if (!best || v[0] > best[0] || (v[0] === best[0] && v[1] > best[1])) best = v
  }
  return best ? `v${best[0]}.${best[1] + 1}` : 'v1.0'
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

/**
 * Demo pending edits on Data and Storage so the release preview has a migration and provisioning
 * to show. Applied once on top of the seed; the snapshot from *before* them is the released baseline.
 */
export function demoSchemaChanges(): { changes: Change[]; apply: (def: AppDefinition) => AppDefinition } {
  const priority: TableField = {
    key: 'priority',
    name: 'Priority',
    type: 'single_select',
    options: ['Low', 'Normal', 'High', 'Urgent'],
  }
  const bucket = {
    name: 'fieldops-signatures',
    purpose: 'Customer sign-off signatures',
    access: 'private' as const,
    versioning: true,
  }
  return {
    changes: [
      {
        id: 'chg_rel_1',
        key: 'data.tables.work_orders.fields.priority',
        area: 'Database',
        author: 'Studio AI',
        authorKind: 'ai',
        text: 'Added “Priority” field to Work orders (Low, Normal, High, Urgent)',
        machinePath: '+ data.tables.work_orders.fields.priority',
        ops: [{ op: 'add', path: '/data/tables/work_orders/fields/-', value: priority }],
        baseVersion: 141,
        createdAt: ago(60 * 3),
      },
      {
        id: 'chg_rel_2',
        key: 'storage.object.field_files.buckets.fieldops-signatures',
        area: 'Storage',
        author: 'Maya Chen',
        authorKind: 'human',
        text: 'Added private bucket “fieldops-signatures” for customer sign-offs',
        machinePath: '+ storage.object.field_files.buckets.fieldops-signatures',
        ops: [{ op: 'add', path: '/storage/object/field_files/buckets/-', value: bucket }],
        baseVersion: 141,
        createdAt: ago(45),
      },
    ],
    apply: (def) => ({
      ...def,
      data: {
        ...def.data,
        tables: def.data.tables.map((t) =>
          t.id === 'work_orders' && !t.fields.some((f) => f.key === 'priority')
            ? { ...t, fields: [...t.fields, priority] }
            : t,
        ),
      },
      storage: {
        ...def.storage,
        object: def.storage.object.map((s) =>
          s.id === 'field_files' && !s.buckets.some((b) => b.name === bucket.name)
            ? { ...s, buckets: [...s.buckets, bucket] }
            : s,
        ),
      },
    }),
  }
}

export interface ReleaseHistoryEntry {
  changes: Change[]
  migrations: Migration[]
  provisioning: ProvisioningStep[]
}

/** What went into the seeded releases v1.2–v1.4, for the version diff view. */
export function seedReleaseHistory(): Record<string, ReleaseHistoryEntry> {
  const c = (
    id: string,
    rel: string,
    area: Change['area'],
    text: string,
    machinePath: string,
    path: string,
    value: unknown,
    min: number,
    ai = false,
  ): Change => ({
    id,
    key: machinePath.slice(2),
    area,
    author: ai ? 'Studio AI' : 'Maya Chen',
    authorKind: ai ? 'ai' : 'human',
    text,
    machinePath,
    ops: [
      {
        op: machinePath.startsWith('-') ? 'remove' : machinePath.startsWith('~') ? 'replace' : 'add',
        path,
        ...(machinePath.startsWith('-') ? {} : { value }),
      },
    ],
    baseVersion: 100,
    createdAt: ago(min),
    releaseId: rel,
  })
  return {
    rel_v1_4: {
      changes: [
        c(
          'h1',
          'rel_v1_4',
          'Database',
          'Added “Parts used” table',
          '+ data.tables.parts_used',
          '/data/tables/-',
          { id: 'parts_used', name: 'Parts used' },
          60 * 24 * 11,
        ),
        c(
          'h2',
          'rel_v1_4',
          'Database',
          'Added “Region” field to Technicians',
          '+ data.tables.technicians.fields.region',
          '/data/tables/technicians/fields/-',
          { key: 'region', type: 'single_select' },
          60 * 24 * 11,
        ),
        c(
          'h3',
          'rel_v1_4',
          'Pages',
          'Added Technicians page',
          '+ interface.pages.technicians',
          '/interface/pages/-',
          { id: 'technicians', name: 'Technicians' },
          60 * 24 * 10,
          true,
        ),
        c(
          'h4',
          'rel_v1_4',
          'Pages',
          'Added “Parts used” table to Work order details',
          '+ interface.pages.order_detail.blocks.od3',
          '/interface/pages/order_detail/blocks/-',
          { id: 'od3', type: 'table' },
          60 * 24 * 10,
          true,
        ),
      ],
      migrations: [
        {
          file: 'V127__create_parts_used.sql',
          connection: 'main',
          summary: 'Create table “Parts used” with 4 fields',
          sql: 'CREATE TABLE "parts_used" (\n  "id" BIGSERIAL PRIMARY KEY,\n  "part" VARCHAR(255) NOT NULL,\n  "order" BIGINT,\n  "qty" NUMERIC(12,2),\n  "cost" NUMERIC(12,2)\n);',
        },
        {
          file: 'V128__add_region_to_technicians.sql',
          connection: 'main',
          summary: 'Technicians: 1 change',
          sql: 'ALTER TABLE "technicians" ADD COLUMN "region" VARCHAR(64);',
        },
      ],
      provisioning: [],
    },
    rel_v1_3: {
      changes: [
        c(
          'h5',
          'rel_v1_3',
          'Permissions',
          'Added Customer role',
          '+ roles.customer',
          '/roles/-',
          { id: 'customer', name: 'Customer' },
          60 * 24 * 29,
        ),
        c(
          'h6',
          'rel_v1_3',
          'Permissions',
          'Customers only see their company’s work orders',
          '~ interface.pages.orders.permissions.customer',
          '/interface/pages/orders/permissions/customer',
          { view: true, create: false, edit: false, delete: false },
          60 * 24 * 29,
        ),
        c(
          'h7',
          'rel_v1_3',
          'Storage',
          'Added “fieldops-documents” bucket for signed reports',
          '+ storage.object.field_files.buckets.fieldops-documents',
          '/storage/object/field_files/buckets/-',
          { name: 'fieldops-documents', access: 'signed' },
          60 * 24 * 29,
          true,
        ),
      ],
      migrations: [
        {
          file: 'V119__customer_role.sql',
          connection: 'main',
          summary: 'Customers: 1 change',
          sql: 'ALTER TABLE "customers" ADD COLUMN "portal_user" UUID;',
        },
      ],
      provisioning: [
        {
          kind: 'bucket',
          action: 'create',
          target: 'field_files / fieldops-documents',
          summary: 'Create bucket fieldops-documents · signed · versioned',
        },
      ],
    },
    rel_v1_2: {
      changes: [
        c(
          'h8',
          'rel_v1_2',
          'Workflow',
          'Added Work order workflow (New → Scheduled → In progress → Done)',
          '+ workflows.work_order',
          '/workflows/-',
          { id: 'work_order', name: 'Work order' },
          60 * 24 * 39,
        ),
        c(
          'h9',
          'rel_v1_2',
          'Database',
          'Status field now follows the Work order workflow',
          '~ data.tables.work_orders.fields.status.type',
          '/data/tables/work_orders/fields/status/type',
          'workflow_state',
          60 * 24 * 39,
        ),
      ],
      migrations: [
        {
          file: 'V101__work_order_states.sql',
          connection: 'main',
          summary: 'Work orders: 1 change',
          sql: 'ALTER TABLE "work_orders" ALTER COLUMN "status" TYPE VARCHAR(64) USING "status"::VARCHAR(64);',
        },
      ],
      provisioning: [],
    },
  }
}

/** Logic tests the runtime knows about. `fails` marks the deliberately failing demo case. */
export interface SeedTest extends TestCase {
  ms: number
  fails?: string
}

export function seedTests(def: AppDefinition): SeedTest[] {
  const out: SeedTest[] = []
  const fnName = (id: string) => def.logic.functions.find((f) => f.id === id)?.name ?? id
  const has = (id: string) => def.logic.functions.some((f) => f.id === id)
  if (has('calc_sla_due'))
    out.push(
      {
        id: 't_sla_high',
        group: fnName('calc_sla_due'),
        kind: 'function',
        name: 'High priority is due in 4 hours',
        ms: 12,
      },
      {
        id: 't_sla_weekend',
        group: fnName('calc_sla_due'),
        kind: 'function',
        name: 'Skips weekends for low priority',
        ms: 9,
      },
    )
  if (has('assign_nearest_tech'))
    out.push(
      {
        id: 't_assign_closest',
        group: fnName('assign_nearest_tech'),
        kind: 'function',
        name: 'Picks the closest available technician',
        ms: 48,
      },
      {
        id: 't_assign_none',
        group: fnName('assign_nearest_tech'),
        kind: 'function',
        name: 'Returns null when nobody is on shift',
        ms: 51,
        fails:
          'Expected: null\nReceived: { id: "sam", name: "Sam Ortiz" }\n  at assignNearestTech.test.ts:31',
      },
    )
  for (const api of def.logic.apis.slice(0, 2)) {
    const g = `${api.method} ${api.path}`
    out.push({
      id: `t_api_${api.id}_auth`,
      group: g,
      kind: 'api',
      name: 'Rejects a request without a token',
      ms: 64,
    })
    out.push({
      id: `t_api_${api.id}_ok`,
      group: g,
      kind: 'api',
      name: 'Returns 200 with a valid body',
      ms: 118,
    })
  }
  const orders = def.interface.pages.find((p) => p.id === 'orders')
  if (orders)
    out.push(
      {
        id: 't_page_tech',
        group: `${orders.name} page`,
        kind: 'page',
        name: 'Technician only sees own jobs',
        ms: 210,
      },
      {
        id: 't_page_customer',
        group: `${orders.name} page`,
        kind: 'page',
        name: 'Customer cannot edit status',
        ms: 174,
      },
    )
  return out
}
