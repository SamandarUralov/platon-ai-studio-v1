/**
 * Tests tab model: client-side definition checks (from the validators' problems) plus the
 * logic/API/page tests the runtime knows about (server). Results live in the console store.
 */
import { computed, toRef } from 'vue'
import type { Problem, TestKind } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { useDefinitionStore } from '@/stores/definition'
import { useConsoleStore } from './useConsoleLog'
import { runTests, useTestCases } from './api'

export interface TestRow {
  id: string
  group: string
  kind: TestKind | 'definition'
  name: string
  /** Definition pointer prefix for definition checks. */
  prefix?: string
}

const CHECKS: { id: string; name: string; prefix: string }[] = [
  { id: 'def:pages', name: 'Pages, blocks and page scripts', prefix: '/interface' },
  { id: 'def:functions', name: 'Functions: references, arguments and returns', prefix: '/logic/functions' },
  { id: 'def:apis', name: 'APIs: access, paths and handlers', prefix: '/logic/apis' },
  { id: 'def:jobs', name: 'Crons and queues', prefix: '/logic/c' },
  { id: 'def:data', name: 'Tables, links and connections', prefix: '/data' },
]

const under = (problems: Problem[], prefix: string) =>
  problems.filter((p) =>
    prefix === '/logic/c'
      ? /^\/logic\/(crons|queues)(\/|$)/.test(p.path)
      : p.path === prefix || p.path.startsWith(prefix + '/'),
  )

export function useTests() {
  const def = useDefinitionStore()
  const store = useConsoleStore()
  const cases = useTestCases(toRef(def, 'projectId'))

  const rows = computed<TestRow[]>(() => [
    ...CHECKS.map((c) => ({
      id: c.id,
      group: 'Definition checks',
      kind: 'definition' as const,
      name: c.name,
      prefix: c.prefix,
    })),
    ...(cases.data.value ?? []),
  ])

  const groups = computed(() => {
    const map = new Map<string, TestRow[]>()
    for (const r of rows.value) map.set(r.group, [...(map.get(r.group) ?? []), r])
    return [...map.entries()].map(([name, tests]) => ({ name, kind: tests[0]!.kind, tests }))
  })

  const summary = computed(() => {
    const ran = rows.value.filter((r) => ['pass', 'fail'].includes(store.runs[r.id]?.state ?? 'idle'))
    const failed = ran.filter((r) => store.runs[r.id]?.state === 'fail').length
    return {
      total: rows.value.length,
      ran: ran.length,
      failed,
      passed: ran.length - failed,
      running: rows.value.some((r) => store.runs[r.id]?.state === 'running'),
    }
  })

  function checkDefinition(ids: string[]) {
    for (const id of ids) {
      const c = CHECKS.find((x) => x.id === id)
      if (!c) continue
      const found = under(def.problems, c.prefix)
      const errors = found.filter((p) => p.severity === 'error')
      const warnings = found.length - errors.length
      store.runs[id] = errors.length
        ? {
            id,
            state: 'fail',
            status: 'fail',
            ms: 3,
            error: errors.map((p) => `${p.message}\n  at ${p.path}`).join('\n'),
          }
        : {
            id,
            state: 'pass',
            status: 'pass',
            ms: 2,
            ...(warnings ? { note: `${warnings} warning${warnings === 1 ? '' : 's'}` } : {}),
          }
    }
  }

  async function run(ids?: string[]) {
    const pid = def.projectId
    if (!pid) return
    const target = ids ?? rows.value.map((r) => r.id)
    for (const id of target) store.runs[id] = { state: 'running' }
    checkDefinition(target.filter((id) => id.startsWith('def:')))
    const server = target.filter((id) => !id.startsWith('def:'))
    if (server.length) {
      try {
        const res = await runTests(pid, { ids: server })
        for (const r of res.results) store.runs[r.id] = { ...r, state: r.status }
      } catch (e) {
        for (const id of server) store.runs[id] = { state: 'idle' }
        store.push({ level: 'error', source: 'tests', message: `Couldn’t run tests: ${errorMessage(e)}` })
        return
      }
    }
    const failed = target.filter((id) => store.runs[id]?.state === 'fail').length
    store.push({
      level: failed ? 'error' : 'info',
      source: 'tests',
      message: `${target.length - failed} passed${failed ? `, ${failed} failed` : ''} · ${target.length} test${target.length === 1 ? '' : 's'}`,
    })
  }

  /** For the terminal: run tests whose group/name contains `filter`; returns how many. */
  function runMatching(filter: string): number {
    const q = filter.toLowerCase()
    const ids = rows.value
      .filter((r) => !q || `${r.group} ${r.name}`.toLowerCase().includes(q))
      .map((r) => r.id)
    if (ids.length) void run(ids)
    return ids.length
  }

  function reset() {
    store.runs = {}
  }

  return { rows, groups, summary, loading: cases.isLoading, run, runMatching, reset }
}
