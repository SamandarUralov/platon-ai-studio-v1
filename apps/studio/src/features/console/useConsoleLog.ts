/**
 * Console dock state: the log stream any feature can write to, the active tab and test results.
 *
 *   const log = useConsoleLog()
 *   log.push({ level: 'warn', source: 'fn · assignNearestTech', message: 'No technician within 25 km' })
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { Problem, TestResult } from '@platon/definition'
import type { ShellLine } from './terminal'
import { useDefinitionStore } from '@/stores/definition'
import { useUiStore } from '@/stores/ui'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'
export type ConsoleTab = 'console' | 'tests' | 'terminal'
export type LogFilter = 'all' | 'warn' | 'error'

export interface ConsoleEntry {
  id: number
  level: LogLevel
  /** Where it came from, e.g. "api · POST /work-orders", "releases", "problems". */
  source: string
  message: string
  at: Date
  /** Definition pointer to jump to, when the entry is about one item. */
  path?: string
}

export interface ConsoleEntryInput {
  level?: LogLevel
  source: string
  message: string
  at?: Date | string
  path?: string
}

export interface TestRun extends Partial<TestResult> {
  state: 'idle' | 'running' | 'pass' | 'fail'
  /** Extra note for passing checks, e.g. "2 warnings". */
  note?: string
}

const MAX_ENTRIES = 1000

export const useConsoleStore = defineStore('console', () => {
  const entries = shallowRef<ConsoleEntry[]>([])
  const tab = ref<ConsoleTab>('console')
  const filter = ref<LogFilter>('all')
  const search = ref('')
  const runs = ref<Record<string, TestRun>>({})
  /** Terminal scrollback and command history survive closing the dock. */
  const shellLines = shallowRef<ShellLine[]>([])
  const shellHistory = ref<string[]>([])
  let seq = 0

  function push(e: ConsoleEntryInput): ConsoleEntry {
    const entry: ConsoleEntry = {
      id: ++seq,
      level: e.level ?? 'log',
      source: e.source,
      message: e.message,
      at: e.at ? new Date(e.at) : new Date(),
      ...(e.path ? { path: e.path } : {}),
    }
    const next = [...entries.value, entry]
    entries.value = next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
    return entry
  }

  function clear() {
    entries.value = []
  }

  const counts = computed(() => {
    let warn = 0
    let error = 0
    for (const e of entries.value) {
      if (e.level === 'warn') warn++
      else if (e.level === 'error') error++
    }
    return { all: entries.value.length, warn, error }
  })

  const visible = computed(() => {
    const q = search.value.trim().toLowerCase()
    return entries.value.filter(
      (e) =>
        (filter.value === 'all' || e.level === filter.value) &&
        (!q || e.message.toLowerCase().includes(q) || e.source.toLowerCase().includes(q)),
    )
  })

  const failingTests = computed(() => Object.values(runs.value).filter((r) => r.state === 'fail').length)

  // ---- seed + problems summary --------------------------------------------------------------
  const def = useDefinitionStore()
  let seededFor: string | null = null

  function seedRuntime() {
    const now = Date.now()
    const at = (s: number) => new Date(now - s * 1000)
    push({
      level: 'info',
      source: 'runtime',
      message: 'Dev server ready · Development environment',
      at: at(420),
    })
    const primary = def.definition?.data.connections.find((c) => c.role === 'primary')
    if (primary)
      push({
        level: 'info',
        source: `db · ${primary.id}`,
        message: `Connected · ${def.definition!.data.tables.filter((t) => t.connection === primary.id).length} tables`,
        at: at(300),
      })
    const page = def.definition?.interface.pages[1] ?? def.definition?.interface.pages[0]
    if (page)
      push({
        level: 'log',
        source: `page · ${page.name}`,
        message: 'onLoad() · 24 rows loaded',
        at: at(240),
        path: `/interface/pages/${page.id}`,
      })
    const fn = def.definition?.logic.functions.find((f) => f.id === 'assign_nearest_tech')
    if (fn)
      push({
        level: 'warn',
        source: `fn · ${fn.name}`,
        message: 'No technician within 25 km for WO-1042. Fell back to region queue.',
        at: at(180),
        path: `/logic/functions/${fn.id}`,
      })
    const cron = def.definition?.logic.crons[0]
    if (cron)
      push({
        level: 'log',
        source: `cron · ${cron.name}`,
        message: 'Checked 18 open orders · 2 overdue',
        at: at(95),
        path: `/logic/crons/${cron.id}`,
      })
    const api = def.definition?.logic.apis.find((a) => a.method === 'POST')
    if (api)
      push({
        level: 'error',
        source: `api · ${api.method} ${api.path}`,
        message: 'ValidationError: customerId is required\n    at createWorkOrder (createWorkOrder.ts:12)',
        at: at(40),
        path: `/logic/apis/${api.id}`,
      })
    const queue = def.definition?.logic.queues[0]
    if (queue)
      push({
        level: 'log',
        source: `queue · ${queue.name}`,
        message: 'Delivered 3 messages',
        at: at(8),
        path: `/logic/queues/${queue.id}`,
      })
  }

  function summarize(problems: Problem[], initial: boolean) {
    const errors = problems.filter((p) => p.severity === 'error')
    const warnings = problems.filter((p) => p.severity === 'warning')
    if (initial)
      for (const p of [...errors, ...warnings].slice(0, 8))
        push({
          level: p.severity === 'error' ? 'error' : 'warn',
          source: 'problems',
          message: p.message,
          path: p.path,
        })
    const text =
      !errors.length && !warnings.length
        ? 'Definition checked · no problems'
        : `Definition checked · ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}${errors.length ? ' · releases are blocked' : ''}`
    push({
      level: errors.length ? 'error' : warnings.length ? 'warn' : 'info',
      source: 'validator',
      message: text,
    })
  }

  let lastSig = ''
  watch(
    () => [def.projectId, def.problems] as const,
    ([pid, problems]) => {
      if (!pid || !def.definition) return
      const initial = seededFor !== pid
      if (initial) {
        seededFor = pid
        entries.value = []
        runs.value = {}
        shellLines.value = []
        seedRuntime()
      }
      const sig = problems.map((p) => `${p.severity}:${p.code}:${p.path}`).join('|')
      if (!initial && sig === lastSig) return
      lastSig = sig
      summarize(problems, initial)
    },
    { immediate: true },
  )

  return {
    entries,
    tab,
    filter,
    search,
    runs,
    shellLines,
    shellHistory,
    counts,
    visible,
    failingTests,
    push,
    clear,
  }
})

/** Public API for other features: write to the console and open the dock. */
export function useConsoleLog() {
  const store = useConsoleStore()
  const ui = useUiStore()
  return {
    push: (e: ConsoleEntryInput) => store.push(e),
    clear: () => store.clear(),
    open: (tab: ConsoleTab = 'console') => {
      store.tab = tab
      ui.consoleOpen = true
    },
  }
}
