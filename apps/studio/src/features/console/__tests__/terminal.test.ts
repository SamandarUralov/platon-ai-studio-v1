import { describe, expect, it, vi } from 'vitest'
import { fieldopsDefinition } from '@platon/mocks/seed'
import {
  execute,
  formatTable,
  historyStep,
  parseCallArgs,
  parseCommand,
  tokenize,
  type ShellContext,
} from '../terminal'

describe('tokenize', () => {
  it('splits words and honours quotes', () => {
    expect(tokenize('call fn  a=1 text="hello world" \'x y\'')).toEqual([
      'call',
      'fn',
      'a=1',
      'text=hello world',
      'x y',
    ])
  })
  it('keeps JSON objects and arrays as one token', () => {
    expect(tokenize('call fn {"a": "b c", "d": [1, 2]} tail')).toEqual([
      'call',
      'fn',
      '{"a": "b c", "d": [1, 2]}',
      'tail',
    ])
  })
  it('does not end a JSON token on a brace inside a string', () => {
    expect(tokenize('{"a":"}"} x')).toEqual(['{"a":"}"}', 'x'])
  })
  it('keeps empty quoted strings', () => {
    expect(tokenize('a "" b')).toEqual(['a', '', 'b'])
  })
})

describe('parseCommand', () => {
  it('returns null for blank lines', () => {
    expect(parseCommand('   ')).toBeNull()
  })
  it('lower-cases the name and keeps the raw rest', () => {
    expect(parseCommand('  QUERY select * from work_orders limit 2 ')).toEqual({
      name: 'query',
      args: ['select', '*', 'from', 'work_orders', 'limit', '2'],
      rest: 'select * from work_orders limit 2',
    })
  })
})

describe('parseCallArgs', () => {
  const params = ['order_id', 'trade']
  it('maps positional values in parameter order', () => {
    expect(parseCallArgs(params, ['wo_1', 'hvac'])).toEqual({ order_id: 'wo_1', trade: 'hvac' })
  })
  it('accepts key=value with coercion', () => {
    expect(parseCallArgs(params, ['order_id=wo_1', 'n=3', 'ok=true', 'tags=["a"]'])).toEqual({
      order_id: 'wo_1',
      n: 3,
      ok: true,
      tags: ['a'],
    })
  })
  it('accepts a JSON object', () => {
    expect(parseCallArgs(params, ['{"order_id":"wo_9"}'])).toEqual({ order_id: 'wo_9' })
  })
  it('rejects extra positional values and non-object JSON', () => {
    expect(() => parseCallArgs(params, ['a', 'b', 'c'])).toThrow(/Too many/)
    expect(() => parseCallArgs(params, ['{"a":1'])).toThrow()
  })
})

describe('historyStep', () => {
  const h = ['help', 'dbs', 'fns']
  it('walks back and forward and stops at the ends', () => {
    let s = historyStep(h, h.length, -1)
    expect(s).toEqual({ index: 2, value: 'fns' })
    s = historyStep(h, s.index, -1)
    s = historyStep(h, s.index, -1)
    s = historyStep(h, s.index, -1)
    expect(s).toEqual({ index: 0, value: 'help' })
    s = historyStep(h, 2, 1)
    expect(s).toEqual({ index: 3, value: '' })
  })
})

describe('formatTable', () => {
  it('pads columns and truncates long cells', () => {
    const [head, row] = formatTable(['a', 'b'], [{ a: 'x'.repeat(30), b: null }], 8)
    expect(head).toBe('a       b')
    expect(row).toBe('xxxxx…  —')
  })
})

describe('execute', () => {
  const ctx = (over: Partial<ShellContext> = {}): ShellContext => ({
    def: fieldopsDefinition(),
    env: 'development',
    role: 'Owner',
    projectName: 'FieldOps',
    problems: [],
    call: vi.fn(async () => ({ result: { ok: true }, ms: 12, logs: ['step 1 · select'] })),
    query: vi.fn(async () => ({ columns: ['ref'], rows: [{ ref: 'WO-1' }], total: 8, ms: 2 })),
    runTests: vi.fn(() => 3),
    errorText: (e) => (e instanceof Error ? e.message : String(e)),
    ...over,
  })

  it('lists help, dbs, tables and fns from the definition', async () => {
    expect((await execute('help', ctx())) as unknown[]).toHaveLength(10)
    const dbs = await execute('dbs', ctx())
    expect(Array.isArray(dbs) && dbs[0]!.text).toContain('main')
    const tables = await execute('tables main', ctx())
    expect(Array.isArray(tables) && tables.at(-1)!.text).toBe('4 tables')
    expect(await execute('tables nope', ctx())).toEqual([
      { text: 'Database not found: nope. Try dbs.', tone: 'err' },
    ])
    const fns = await execute('fns', ctx())
    expect(Array.isArray(fns) && fns.some((l) => l.text.includes('calcSlaDue(order_id: string)'))).toBe(true)
  })

  it('calls a function with parsed args', async () => {
    const c = ctx()
    const out = await execute('call calcSlaDue wo_1042', c)
    expect(c.call).toHaveBeenCalledWith('calcSlaDue', { order_id: 'wo_1042' })
    expect(Array.isArray(out) && out.at(-1)!.text).toBe('done in 12 ms')
  })

  it('reports unknown functions and commands', async () => {
    expect(await execute('call nope', ctx())).toEqual([
      { text: 'Function not found: nope. Try fns.', tone: 'err' },
    ])
    expect(await execute('rm -rf', ctx())).toEqual([
      { text: 'rm: command not found. Type help.', tone: 'err' },
    ])
  })

  it('runs queries, also as bare SELECT', async () => {
    const c = ctx()
    await execute('select ref from work_orders', c)
    expect(c.query).toHaveBeenCalledWith('select ref from work_orders')
    const out = await execute('query work_orders', c)
    expect(Array.isArray(out) && out.at(-1)!.text).toBe('1 of 8 rows · 2 ms')
  })

  it('surfaces server errors', async () => {
    const out = await execute(
      'query x',
      ctx({ query: async () => Promise.reject(new Error('Table not found: x')) }),
    )
    expect(out).toEqual([{ text: 'Table not found: x', tone: 'err' }])
  })

  it('clears and runs tests', async () => {
    expect(await execute('clear', ctx())).toBe('clear')
    const c = ctx({ runTests: vi.fn(() => 0) })
    expect(await execute('test zzz', c)).toEqual([{ text: 'No tests match', tone: 'err' }])
    expect(c.runTests).toHaveBeenCalledWith('zzz')
  })
})
