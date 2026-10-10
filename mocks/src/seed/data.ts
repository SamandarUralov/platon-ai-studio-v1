/**
 * Data-layer mock helpers: realistic test rows per field type and a tiny read-only SQL engine
 * that runs `SELECT … FROM table [WHERE …] [GROUP BY …] [ORDER BY …] [LIMIT n]` over records.
 * Pure (no MSW), so it is unit-tested directly.
 */
import { faker } from '@faker-js/faker'
import type { AppDefinition, DataRow, SqlResponse, Table, TableField } from '@platon/definition'

type Rows = Record<string, unknown>[]

// ───────────────────────── test data ─────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function textFor(f: TableField): string {
  const k = `${f.key} ${f.name}`.toLowerCase()
  if (/company|customer|client|vendor/.test(k)) return faker.company.name()
  if (/contact|person|owner|name/.test(k)) return faker.person.fullName()
  if (/city/.test(k)) return faker.location.city()
  if (/address|street/.test(k)) return faker.location.streetAddress()
  if (/email|login/.test(k)) return faker.internet.email().toLowerCase()
  if (/phone|mobile/.test(k)) return faker.phone.number()
  if (/part|product|item/.test(k)) return faker.commerce.productName()
  if (/^key\b/.test(k)) return faker.string.alphanumeric(4).toLowerCase()
  if (/job|title|subject|task/.test(k))
    return cap(`${faker.hacker.verb()} ${faker.hacker.adjective()} ${faker.hacker.noun()}`)
  return cap(faker.lorem.words(2))
}

/** What a link cell shows: the first field of the target row (ref, name…). */
export function displayOf(table: Table | undefined, row: Record<string, unknown>): string {
  const first = table?.fields[0]
  const v = first ? row[first.key] : undefined
  return v == null || v === '' ? String(row.id ?? '') : String(v)
}

function nextAuto(rows: Rows, key: string, tableId: string): string {
  let prefix = tableId
    .split('_')
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  let max = 1000
  for (const r of rows) {
    const m = /^(.*?)(\d+)$/.exec(String(r[key] ?? ''))
    if (m) {
      prefix = m[1]!.replace(/-$/, '') || prefix
      max = Math.max(max, Number(m[2]))
    }
  }
  return `${prefix}-${max + 1}`
}

export function fakeValue(
  f: TableField,
  def: AppDefinition,
  records: Record<string, Rows>,
  tableRows: Rows,
  tableId: string,
): unknown {
  switch (f.type) {
    case 'auto_number':
      return nextAuto(tableRows, f.key, tableId)
    case 'text':
      return textFor(f)
    case 'long_text':
      return faker.lorem.sentence()
    case 'number':
      return String(faker.number.int({ min: 0, max: 40 }) / 2)
    case 'currency':
      return `$${faker.number.int({ min: 5, max: 2500 }).toLocaleString('en-US')}`
    case 'date':
      return faker.date.soon({ days: 30 }).toISOString().slice(0, 10)
    case 'datetime':
      return faker.date.soon({ days: 30 }).toISOString()
    case 'checkbox':
      return faker.datatype.boolean()
    case 'single_select':
      return f.options?.length ? faker.helpers.arrayElement(f.options) : ''
    case 'workflow_state': {
      const wf = def.workflows?.find((w) => w.id === f.workflow)
      const names = wf?.states.map((s) => s.name) ?? f.options ?? []
      return names.length ? faker.helpers.arrayElement(names) : ''
    }
    case 'multi_select':
      return f.options?.length ? faker.helpers.arrayElements(f.options, { min: 1, max: 2 }).join(', ') : ''
    case 'user_account':
      return faker.internet.email().toLowerCase()
    case 'file':
      return faker.helpers.arrayElement(['—', '1 photo', '2 photos', '3 photos'])
    case 'link': {
      const target = def.data.tables.find((t) => t.id === f.link)
      const pool = (f.link && records[f.link]) || []
      return pool.length ? displayOf(target, faker.helpers.arrayElement(pool)) : ''
    }
    case 'json':
      return '{}'
  }
}

/** `count` rows for `table`, linked to existing rows of the tables it points to. */
export function generateRows(
  table: Table,
  def: AppDefinition,
  records: Record<string, Rows>,
  count: number,
): DataRow[] {
  const existing = [...(records[table.id] ?? [])]
  const out: DataRow[] = []
  for (let i = 0; i < count; i++) {
    const row: DataRow = { id: `rec_${faker.string.alphanumeric(8).toLowerCase()}`, _test: true }
    for (const f of table.fields) row[f.key] = fakeValue(f, def, records, existing, table.id)
    existing.push(row)
    out.push(row)
  }
  return out
}

// ───────────────────────── SQL ─────────────────────────

export class SqlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SqlError'
  }
}

type Tok = { t: 'id' | 'str' | 'num' | 'sym'; v: string }

export function tokenize(sql: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < sql.length) {
    const c = sql[i]!
    if (/\s/.test(c)) {
      i++
    } else if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
    } else if (c === "'") {
      let s = ''
      i++
      for (;;) {
        if (i >= sql.length) throw new SqlError('Unterminated string literal')
        if (sql[i] === "'" && sql[i + 1] === "'") {
          s += "'"
          i += 2
        } else if (sql[i] === "'") {
          i++
          break
        } else s += sql[i++]
      }
      out.push({ t: 'str', v: s })
    } else if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?/.exec(sql.slice(i))!
      out.push({ t: 'num', v: m[0] })
      i += m[0].length
    } else if (/[A-Za-z_"`[]/.test(c)) {
      const m = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_]*)/.exec(sql.slice(i))!
      out.push({ t: 'id', v: m[0].replace(/^["`[]|["`\]]$/g, '') })
      i += m[0].length
    } else {
      const two = sql.slice(i, i + 2)
      if (['!=', '<>', '<=', '>='].includes(two)) {
        out.push({ t: 'sym', v: two })
        i += 2
      } else if ('(),*=<>.;'.includes(c)) {
        out.push({ t: 'sym', v: c })
        i++
      } else throw new SqlError(`Unexpected character “${c}”`)
    }
  }
  return out
}

type Op = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'in' | 'null' | 'notnull'
interface Cond {
  col: string
  op: Op
  vals: string[]
}
interface SelItem {
  kind: 'col' | 'count' | 'star'
  col?: string
  as: string
}
export interface SelectAst {
  items: SelItem[]
  table: string
  where: Cond[][] // OR of ANDs
  groupBy?: string
  orderBy: { col: string; desc: boolean }[]
  limit?: number
}

export function parseSelect(sql: string): SelectAst {
  const toks = tokenize(sql)
  let p = 0
  const peek = () => toks[p]
  const kw = (w: string) => peek()?.t === 'id' && peek()!.v.toUpperCase() === w
  const eat = (w: string) => {
    if (kw(w)) return ++p
    return 0
  }
  const sym = (s: string) => (peek()?.t === 'sym' && peek()!.v === s ? ++p : 0)
  const need = (w: string) => {
    if (!eat(w)) throw new SqlError(`Expected ${w} near “${peek()?.v ?? 'end of input'}”`)
  }
  const ident = (): string => {
    const t = toks[p]
    if (t?.t !== 'id') throw new SqlError(`Expected a name near “${t?.v ?? 'end of input'}”`)
    p++
    // Qualified names: schema.table or table.column → keep the last part.
    if (sym('.')) return ident()
    return t.v
  }
  const literal = (): string => {
    const t = toks[p]
    if (!t || (t.t !== 'str' && t.t !== 'num' && !(t.t === 'id' && /^(TRUE|FALSE)$/i.test(t.v))))
      throw new SqlError(`Expected a value near “${t?.v ?? 'end of input'}”`)
    p++
    return t.t === 'id' ? t.v.toLowerCase() : t.v
  }

  if (!kw('SELECT')) {
    const first = peek()?.v.toUpperCase() ?? ''
    if (['CREATE', 'ALTER', 'DROP', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(first))
      throw new SqlError(
        `${first} isn’t run from the console. Change structure in the Fields tab (it ships as a migration) and edit records in the Records tab.`,
      )
    throw new SqlError('Only SELECT statements are supported here.')
  }
  p++
  eat('DISTINCT')
  const items: SelItem[] = []
  do {
    if (sym('*')) items.push({ kind: 'star', as: '*' })
    else if (kw('COUNT') && toks[p + 1]?.v === '(') {
      p += 2
      let col: string | undefined
      if (!sym('*')) col = ident()
      if (!sym(')')) throw new SqlError('Expected ) after COUNT(')
      const as = eat('AS') ? ident() : 'count'
      items.push({ kind: 'count', col, as })
    } else {
      const col = ident()
      const as = eat('AS') ? ident() : col
      items.push({ kind: 'col', col, as })
    }
  } while (sym(','))
  need('FROM')
  const table = ident()
  if (peek()?.t === 'id' && !['WHERE', 'GROUP', 'ORDER', 'LIMIT'].includes(peek()!.v.toUpperCase())) {
    eat('AS')
    ident()
  }
  const where: Cond[][] = []
  if (eat('WHERE')) {
    let group: Cond[] = []
    for (;;) {
      const col = ident()
      let cond: Cond
      if (eat('IS')) {
        const not = !!eat('NOT')
        need('NULL')
        cond = { col, op: not ? 'notnull' : 'null', vals: [] }
      } else if (eat('LIKE') || eat('ILIKE')) cond = { col, op: 'like', vals: [literal()] }
      else if (eat('IN')) {
        if (!sym('(')) throw new SqlError('Expected ( after IN')
        const vals = [literal()]
        while (sym(',')) vals.push(literal())
        if (!sym(')')) throw new SqlError('Expected ) to close IN list')
        cond = { col, op: 'in', vals }
      } else {
        const t = toks[p]
        if (t?.t !== 'sym' || !['=', '!=', '<>', '<', '>', '<=', '>='].includes(t.v))
          throw new SqlError(`Expected a comparison after “${col}”`)
        p++
        cond = { col, op: (t.v === '<>' ? '!=' : t.v) as Op, vals: [literal()] }
      }
      group.push(cond)
      if (eat('AND')) continue
      if (eat('OR')) {
        where.push(group)
        group = []
        continue
      }
      break
    }
    where.push(group)
  }
  let groupBy: string | undefined
  if (eat('GROUP')) {
    need('BY')
    groupBy = ident()
  }
  const orderBy: SelectAst['orderBy'] = []
  if (eat('ORDER')) {
    need('BY')
    do {
      const col = kw('COUNT') && toks[p + 1]?.v === '(' ? ((p += 4), 'count') : ident()
      const desc = !!eat('DESC')
      if (!desc) eat('ASC')
      orderBy.push({ col, desc })
    } while (sym(','))
  }
  let limit: number | undefined
  if (eat('LIMIT')) {
    const t = toks[p++]
    if (t?.t !== 'num') throw new SqlError('LIMIT needs a number')
    limit = Number(t.v)
  }
  sym(';')
  if (p < toks.length) throw new SqlError(`Unexpected “${toks[p]!.v}”`)
  if (groupBy && items.some((i) => i.kind === 'col' && i.col !== groupBy))
    throw new SqlError(`Column must appear in GROUP BY or be used in COUNT()`)
  return { items, table, where, groupBy, orderBy, limit }
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return null
  const s = v.replace(/[$,\s]/g, '')
  return s !== '' && !Number.isNaN(Number(s)) ? Number(s) : null
}

function cmp(a: unknown, b: unknown): number {
  const na = num(a)
  const nb = num(b)
  if (na !== null && nb !== null) return na - nb
  return String(a ?? '').localeCompare(String(b ?? ''))
}

function test(v: unknown, c: Cond): boolean {
  const empty = v === undefined || v === null || v === ''
  switch (c.op) {
    case 'null':
      return empty
    case 'notnull':
      return !empty
    case 'like': {
      const re = new RegExp(
        `^${c.vals[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, '.*')
          .replace(/_/g, '.')}$`,
        'i',
      )
      return re.test(String(v ?? ''))
    }
    case 'in':
      return c.vals.some((x) => cmp(v, x) === 0)
    case '=':
      return !empty && cmp(v, c.vals[0]) === 0
    case '!=':
      return cmp(v, c.vals[0]) !== 0
    case '<':
      return !empty && cmp(v, c.vals[0]) < 0
    case '>':
      return !empty && cmp(v, c.vals[0]) > 0
    case '<=':
      return !empty && cmp(v, c.vals[0]) <= 0
    case '>=':
      return !empty && cmp(v, c.vals[0]) >= 0
  }
}

const MAX_ROWS = 500

/** Run a SELECT against Development records. Throws SqlError with a database-style message. */
export function runSelect(
  sql: string,
  tables: Table[],
  records: Record<string, Rows>,
): Omit<SqlResponse, 'elapsedMs'> {
  const ast = parseSelect(sql)
  const name = ast.table.toLowerCase()
  const table = tables.find(
    (t) => t.id === name || (t.physicalName ?? '').toLowerCase().split('.').pop() === name,
  )
  if (!table) throw new SqlError(`relation "${ast.table}" does not exist`)
  const cols = ['id', ...table.fields.map((f) => f.key)]
  const resolve = (c: string): string => {
    const lc = c.toLowerCase()
    if (cols.includes(lc)) return lc
    const link = table.fields.find((f) => f.type === 'link' && `${f.key}_id` === lc)
    if (link) return link.key
    throw new SqlError(`column "${c}" does not exist`)
  }
  for (const g of ast.where) for (const c of g) c.col = resolve(c.col)
  const rows = (records[table.id] ?? []).filter(
    (r) => !ast.where.length || ast.where.some((g) => g.every((c) => test(r[c.col], c))),
  )

  let columns: string[]
  let out: unknown[][]
  const hasCount = ast.items.some((i) => i.kind === 'count')
  if (ast.groupBy || hasCount) {
    const key = ast.groupBy ? resolve(ast.groupBy) : null
    const groups = new Map<string, Rows>()
    for (const r of rows) {
      const k = key ? String(r[key] ?? '') : ''
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    if (!key && !groups.size) groups.set('', [])
    columns = ast.items.map((i) => i.as)
    out = [...groups.entries()].map(([k, g]) =>
      ast.items.map((i) => {
        if (i.kind === 'count')
          return i.col
            ? g.filter((r) => r[resolve(i.col!)] != null && r[resolve(i.col!)] !== '').length
            : g.length
        if (i.kind === 'col') return key ? k : g[0]?.[resolve(i.col!)]
        throw new SqlError('SELECT * can’t be combined with COUNT()')
      }),
    )
  } else {
    const picks: { as: string; key: string }[] = []
    for (const i of ast.items) {
      if (i.kind === 'star') for (const c of cols) picks.push({ as: c, key: c })
      else picks.push({ as: i.as, key: resolve(i.col!) })
    }
    columns = picks.map((x) => x.as)
    out = rows.map((r) => picks.map((x) => r[x.key] ?? null))
  }

  const sortBy = (list: unknown[][], idxOf: (col: string) => number) => {
    const keys = ast.orderBy.map((o) => ({ i: idxOf(o.col), desc: o.desc }))
    return [...list].sort((a, b) => {
      for (const k of keys) {
        const d = cmp(a[k.i], b[k.i]) * (k.desc ? -1 : 1)
        if (d) return d
      }
      return 0
    })
  }
  if (ast.orderBy.length) {
    if (ast.groupBy || hasCount) {
      out = sortBy(out, (col) => {
        const i = columns.findIndex((c) => c.toLowerCase() === col.toLowerCase())
        if (i < 0) throw new SqlError(`ORDER BY "${col}" must be a selected column`)
        return i
      })
    } else {
      // Sort full rows (so ORDER BY may use columns that aren't selected), then project again.
      const full = rows.map((r, i) => [i, ...cols.map((c) => r[c])])
      const sorted = sortBy(full, (col) => {
        const alias = ast.items.find((i) => i.kind === 'col' && i.as.toLowerCase() === col.toLowerCase())
        return cols.indexOf(resolve(alias?.col ?? col)) + 1
      })
      out = sorted.map((r) => out[r[0] as number]!)
    }
  }

  const limit = Math.min(ast.limit ?? MAX_ROWS, MAX_ROWS)
  const truncated = out.length > limit && ast.limit === undefined
  out = out.slice(0, limit)
  return {
    columns,
    rows: out,
    rowCount: out.length,
    truncated,
    message: `${out.length} row${out.length === 1 ? '' : 's'}${truncated ? ` (first ${MAX_ROWS})` : ''}`,
  }
}
