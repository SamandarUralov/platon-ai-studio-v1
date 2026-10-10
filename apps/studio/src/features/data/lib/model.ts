/** Pure helpers over the data layer of the definition: relations, physical names, CSV, change builders. */
import {
  ENGINES,
  pointer,
  snake,
  uniqueName,
  type ChangeInput,
  type DbConnection,
  type DbEngine,
  type Table,
  type TableField,
  type TableFieldType,
} from '@platon/definition'
import { columnName, tableName } from './ddl'

export const ENV_NAMES = ['development', 'staging', 'production'] as const
export type Env = (typeof ENV_NAMES)[number]

export const DB_ROLES: DbConnection['role'][] = ['primary', 'cache', 'queue', 'external']

export const REDIS_TTLS = ['No expiry', '15 minutes', '1 hour', '1 day', '7 days'] as const
export const REDIS_VALUE_TYPES = ['Hash', 'String', 'List', 'Set', 'Sorted set'] as const

export const TABLE_ICONS = [
  'table-2',
  'clipboard-list',
  'building-2',
  'hard-hat',
  'package',
  'users',
  'user-round',
  'file-text',
  'receipt',
  'truck',
  'map-pin',
  'calendar-days',
  'boxes',
  'wrench',
  'tag',
  'credit-card',
  'key-round',
  'file-braces',
  'inbox',
  'star',
]

/** Default icon for a new table/collection/key set. */
export function defaultIcon(engine: DbEngine): string {
  return engine === 'redis' ? 'key-round' : engine === 'mongo' ? 'file-braces' : 'table-2'
}

/** Where the structure lives on the server: schema.table, db.collection or a Redis key pattern. */
export function physicalNameOf(
  conn: Pick<DbConnection, 'engine' | 'schema' | 'database'>,
  name: string,
  appSlug: string,
): string {
  const sn = snake(name) || `new_${ENGINES[conn.engine].unit.replace(/ /g, '_')}`
  if (conn.engine === 'redis') return `${snake(appSlug) || 'app'}:${sn}:{id}`
  if (conn.engine === 'mongo') return `${conn.database || 'app'}.${sn}`
  if (conn.engine === 'mysql') return `${conn.database || 'app'}.${sn}`
  return `${conn.schema || (conn.engine === 'mssql' ? 'dbo' : 'public')}.${sn}`
}

export interface FkRow {
  /** Referencing side. */
  fromTable: Table
  field: TableField
  /** Referenced side. */
  toTable: Table | undefined
  toId: string
  onDelete: 'RESTRICT' | 'SET NULL'
  constraint: string
}

function fk(from: Table, f: TableField, tables: Table[]): FkRow {
  const to = tables.find((t) => t.id === f.link)
  return {
    fromTable: from,
    field: f,
    toTable: to,
    toId: f.link ?? '',
    onDelete: f.req ? 'RESTRICT' : 'SET NULL',
    constraint: `fk_${tableName(from)}_${columnName(f)}`,
  }
}

/** Foreign keys going out of `table` (its link fields). */
export function relationsOut(table: Table, tables: Table[]): FkRow[] {
  return table.fields.filter((f) => f.type === 'link' && f.link).map((f) => fk(table, f, tables))
}

/** Foreign keys of other tables pointing at `table`. */
export function relationsIn(table: Table, tables: Table[]): FkRow[] {
  return tables.flatMap((t) =>
    t.fields.filter((f) => f.type === 'link' && f.link === table.id).map((f) => fk(t, f, tables)),
  )
}

// ───────── CSV ─────────

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(fields: Pick<TableField, 'key' | 'name'>[], rows: Record<string, unknown>[]): string {
  const head = fields.map((f) => csvCell(f.name)).join(',')
  return [head, ...rows.map((r) => fields.map((f) => csvCell(r[f.key])).join(','))].join('\r\n')
}

// ───────── change builders (every schema edit is a definition change) ─────────

const tablePath = (tableId: string, ...rest: string[]) => pointer('data', 'tables', tableId, ...rest)

export function newFieldKey(name: string, table: Table): string {
  const base = snake(name) || 'field'
  return uniqueName(
    /^[a-z]/.test(base) ? base : `f_${base}`,
    table.fields.map((f) => f.key),
  )
}

export function addFieldChange(table: Table, field: TableField): ChangeInput {
  return {
    key: `data.tables.${table.id}.fields.${field.key}`,
    area: 'Database',
    text: `Added field “${field.name}” to ${table.name}`,
    ops: [{ op: 'add', path: tablePath(table.id, 'fields', '-'), value: field }],
  }
}

/** Set (or clear with `undefined`) one property of a field. */
export function setFieldPropChange<K extends keyof TableField>(
  table: Table,
  field: TableField,
  prop: K,
  value: TableField[K],
  text?: string,
): ChangeInput {
  const path = tablePath(table.id, 'fields', field.key, prop)
  const has = field[prop] !== undefined
  return {
    key: `data.tables.${table.id}.fields.${field.key}.${String(prop)}`,
    area: 'Database',
    text: text ?? `Changed ${String(prop)} of “${field.name}” in ${table.name}`,
    ops:
      value === undefined || value === false || (Array.isArray(value) && !value.length && prop === 'options')
        ? has
          ? [{ op: 'remove', path }]
          : []
        : [{ op: 'add', path, value }],
  }
}

/** Changing the type drops properties that only make sense for the old type. */
export function changeTypeChange(
  table: Table,
  field: TableField,
  type: TableFieldType,
  defaultLink?: string,
): ChangeInput {
  const ops: ChangeInput['ops'] = [
    { op: 'replace', path: tablePath(table.id, 'fields', field.key, 'type'), value: type },
  ]
  const keepOptions = type === 'single_select' || type === 'multi_select'
  if (field.options && !keepOptions)
    ops.push({ op: 'remove', path: tablePath(table.id, 'fields', field.key, 'options') })
  if (field.link && type !== 'link')
    ops.push({ op: 'remove', path: tablePath(table.id, 'fields', field.key, 'link') })
  if (field.storage && type !== 'file')
    ops.push({ op: 'remove', path: tablePath(table.id, 'fields', field.key, 'storage') })
  if (field.workflow && type !== 'workflow_state')
    ops.push({ op: 'remove', path: tablePath(table.id, 'fields', field.key, 'workflow') })
  if (type === 'link' && !field.link && defaultLink)
    ops.push({ op: 'add', path: tablePath(table.id, 'fields', field.key, 'link'), value: defaultLink })
  if (keepOptions && !field.options)
    ops.push({
      op: 'add',
      path: tablePath(table.id, 'fields', field.key, 'options'),
      value: ['Option 1', 'Option 2'],
    })
  return {
    key: `data.tables.${table.id}.fields.${field.key}.type`,
    area: 'Database',
    text: `Changed “${field.name}” in ${table.name} to ${type.replace(/_/g, ' ')}`,
    ops,
  }
}

export function moveFieldChange(table: Table, field: TableField, to: number): ChangeInput {
  return {
    key: `data.tables.${table.id}.fields.order`,
    area: 'Database',
    text: `Reordered fields of ${table.name}`,
    ops: [
      {
        op: 'move',
        from: tablePath(table.id, 'fields', field.key),
        path: tablePath(table.id, 'fields', String(to)),
      },
    ],
  }
}

export function removeFieldChange(table: Table, field: TableField): ChangeInput {
  return {
    key: `data.tables.${table.id}.fields.${field.key}`,
    area: 'Database',
    text: `Removed field “${field.name}” from ${table.name}`,
    ops: [{ op: 'remove', path: tablePath(table.id, 'fields', field.key) }],
  }
}

export function addTableChange(table: Table, connName: string): ChangeInput {
  return {
    key: `data.tables.${table.id}`,
    area: 'Database',
    text: `Created ${ENGINE_UNIT(table)} “${table.name}” in ${connName}`,
    ops: [{ op: 'add', path: pointer('data', 'tables', '-'), value: table }],
  }
}

const ENGINE_UNIT = (t: Table) => (t.ttl !== undefined || t.physicalName?.includes(':') ? 'key set' : 'table')

export function renameTableChange(table: Table, name: string): ChangeInput {
  return {
    key: `data.tables.${table.id}.name`,
    area: 'Database',
    text: `Renamed table ${table.id} to “${name}”`,
    ops: [{ op: 'replace', path: tablePath(table.id, 'name'), value: name }],
  }
}

export function removeTableChange(table: Table): ChangeInput {
  return {
    key: `data.tables.${table.id}`,
    area: 'Database',
    text: `Removed table “${table.name}”`,
    ops: [{ op: 'remove', path: tablePath(table.id) }],
  }
}

export function addConnectionChange(conn: DbConnection): ChangeInput {
  return {
    key: `data.connections.${conn.id}`,
    area: 'Database',
    text: `Added ${ENGINES[conn.engine].label} database “${conn.name}”`,
    ops: [{ op: 'add', path: pointer('data', 'connections', '-'), value: conn }],
  }
}

export function setConnectionPropChange<K extends keyof DbConnection>(
  conn: DbConnection,
  prop: K,
  value: DbConnection[K],
): ChangeInput {
  const path = pointer('data', 'connections', conn.id, prop)
  const has = conn[prop] !== undefined
  return {
    key: `data.connections.${conn.id}.${String(prop)}`,
    area: 'Database',
    text: `Changed ${String(prop)} of “${conn.name}”`,
    ops:
      value === undefined || value === ''
        ? has
          ? [{ op: 'remove', path }]
          : []
        : [{ op: 'add', path, value }],
  }
}

export function setCredentialChange(conn: DbConnection, env: Env, ref: string): ChangeInput {
  const ops: ChangeInput['ops'] = conn.credentials
    ? [{ op: 'add', path: pointer('data', 'connections', conn.id, 'credentials', env), value: ref }]
    : [{ op: 'add', path: pointer('data', 'connections', conn.id, 'credentials'), value: { [env]: ref } }]
  return {
    key: `data.connections.${conn.id}.credentials.${env}`,
    area: 'Database',
    text: `Replaced ${env} credentials of “${conn.name}”`,
    ops,
  }
}

/** Detach removes the connection and the structure that lived in it (the server database stays). */
export function detachConnectionChange(conn: DbConnection, tables: Table[]): ChangeInput {
  const own = tables.filter((t) => t.connection === conn.id)
  return {
    key: `data.connections.${conn.id}`,
    area: 'Database',
    text: `Detached database “${conn.name}”${own.length ? ` and ${own.length} ${ENGINES[conn.engine].unit}${own.length === 1 ? '' : 's'}` : ''}`,
    ops: [
      ...own.map((t) => ({ op: 'remove' as const, path: pointer('data', 'tables', t.id) })),
      { op: 'remove' as const, path: pointer('data', 'connections', conn.id) },
    ],
  }
}
