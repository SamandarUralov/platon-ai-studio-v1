/**
 * The app definition — single source of truth for Canvas, builders, JSON views and AI.
 *
 * Every edit goes through `apply()`: it is applied locally at once (optimistic), queued, and sent
 * to the server in order with the last acknowledged `baseVersion`. On 409 the store reloads the
 * server copy, re-applies the edits that were not acknowledged yet (rebase) and retries.
 * Undo/redo work on change inputs, so an undo is itself a change that is sent and logged.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
  applyPatch,
  getAt,
  invertPatch,
  PatchError,
  upsertChange,
  type AppDefinition,
  type ApplyChangesRequest,
  type ApplyChangesResponse,
  type Change,
  type ChangeInput,
  type DefinitionResponse,
  type Problem,
} from '@platon/definition'
import { validateAll } from '@platon/validators'
import { toast } from '@platon/ui'
import { ApiError, errorMessage, http } from '@/services/http'

export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

interface Pending {
  input: ChangeInput
  authorKind: 'human' | 'ai'
}

interface HistoryEntry {
  forward: ChangeInput
  inverse: ChangeInput
}

const HISTORY_LIMIT = 100

export const useDefinitionStore = defineStore('definition', () => {
  const projectId = ref<string | null>(null)
  /** Local view: server copy + optimistic edits. shallowRef — the tree is replaced, never mutated. */
  const definition = shallowRef<AppDefinition | null>(null)
  const serverDefinition = shallowRef<AppDefinition | null>(null)
  const serverVersion = ref(0)
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const sync = ref<SyncState>('idle')
  const lastSavedAt = ref<Date | null>(null)
  const changes = ref<Change[]>([])
  const problems = shallowRef<Problem[]>([])

  const queue: Pending[] = []
  let flushing = false
  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])

  const ready = computed(() => !!definition.value)
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const errorCount = computed(() => problems.value.filter((p) => p.severity === 'error').length)

  async function load(id: string, force = false) {
    if (!force && projectId.value === id && definition.value) return
    projectId.value = id
    loading.value = true
    loadError.value = null
    queue.length = 0
    undoStack.value = []
    redoStack.value = []
    try {
      const [defRes, chRes] = await Promise.all([
        http.get<DefinitionResponse>(`/projects/${id}/definition`),
        http.get<{ items: Change[] }>(`/projects/${id}/changes`),
      ])
      if (projectId.value !== id) return
      serverDefinition.value = defRes.data.definition
      definition.value = defRes.data.definition
      serverVersion.value = defRes.data.version
      changes.value = chRes.data.items
      sync.value = 'idle'
    } catch (e) {
      loadError.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  function get<T>(path: string): T | undefined {
    return definition.value ? getAt<T>(definition.value, path) : undefined
  }

  /**
   * Apply one or more edits. Returns false (and toasts) when an edit can't be applied locally,
   * e.g. its target was deleted meanwhile.
   */
  function apply(
    input: ChangeInput | ChangeInput[],
    opts: { authorKind?: 'human' | 'ai'; record?: boolean } = {},
  ): boolean {
    const list = Array.isArray(input) ? input : [input]
    if (!definition.value || !list.length) return false
    let doc = definition.value
    const entries: HistoryEntry[] = []
    try {
      for (const c of list) {
        const inverseOps = invertPatch(doc, c.ops)
        doc = applyPatch(doc, c.ops)
        entries.push({ forward: c, inverse: { ...c, text: `Undo: ${c.text}`, ops: inverseOps } })
      }
    } catch (e) {
      toast(e instanceof PatchError ? `Couldn’t apply: ${e.message}` : errorMessage(e), { tone: 'danger' })
      return false
    }
    definition.value = doc
    if (opts.record !== false) {
      undoStack.value = [...undoStack.value, ...entries].slice(-HISTORY_LIMIT)
      redoStack.value = []
    }
    for (const c of list) queue.push({ input: c, authorKind: opts.authorKind ?? 'human' })
    void flush()
    return true
  }

  function undo() {
    const e = undoStack.value.at(-1)
    if (!e) return
    undoStack.value = undoStack.value.slice(0, -1)
    if (apply(e.inverse, { record: false })) redoStack.value = [...redoStack.value, e]
  }

  function redo() {
    const e = redoStack.value.at(-1)
    if (!e) return
    redoStack.value = redoStack.value.slice(0, -1)
    if (apply(e.forward, { record: false })) undoStack.value = [...undoStack.value, e]
  }

  async function flush(): Promise<void> {
    if (flushing || !projectId.value) return
    flushing = true
    sync.value = 'saving'
    const pid = projectId.value
    try {
      while (queue.length && pid === projectId.value) {
        // Send consecutive edits from the same author together.
        const kind = queue[0]!.authorKind
        const batch: Pending[] = []
        while (queue.length && queue[0]!.authorKind === kind && batch.length < 20) batch.push(queue.shift()!)
        const body: ApplyChangesRequest = {
          baseVersion: serverVersion.value,
          changes: batch.map((b) => b.input),
          authorKind: kind,
        }
        try {
          const res = await http.post<ApplyChangesResponse>(`/projects/${pid}/changes`, body)
          serverVersion.value = res.data.version
          serverDefinition.value = batch.reduce((d, b) => applyPatch(d!, b.input.ops), serverDefinition.value)
          for (const c of res.data.changes) changes.value = upsertChange(changes.value, c)
        } catch (e) {
          if (e instanceof ApiError && e.isConflict) {
            queue.unshift(...batch)
            await rebase(pid)
            continue
          }
          // Server rejected the edit: roll the local view back to server + remaining queue.
          rebuildLocal()
          sync.value = 'error'
          toast(`Not saved: ${errorMessage(e)}`, { tone: 'danger' })
          return
        }
      }
      sync.value = 'saved'
      lastSavedAt.value = new Date()
    } finally {
      flushing = false
    }
  }

  /** Reload the server copy and replay unsent edits on top of it. */
  async function rebase(pid: string) {
    sync.value = 'conflict'
    const res = await http.get<DefinitionResponse>(`/projects/${pid}/definition`)
    serverDefinition.value = res.data.definition
    serverVersion.value = res.data.version
    rebuildLocal()
  }

  function rebuildLocal() {
    let doc = serverDefinition.value
    if (!doc) return
    const kept: Pending[] = []
    for (const p of queue) {
      try {
        doc = applyPatch(doc, p.input.ops)
        kept.push(p)
      } catch {
        toast(`Dropped “${p.input.text}” — someone changed the same item`, { tone: 'warn' })
      }
    }
    queue.splice(0, queue.length, ...kept)
    definition.value = doc
  }

  async function refreshChanges() {
    if (!projectId.value) return
    changes.value = (await http.get<{ items: Change[] }>(`/projects/${projectId.value}/changes`)).data.items
  }

  // Client-side problems — debounced so typing stays smooth (NFR: < 150 ms per check).
  const revalidate = useDebounceFn(() => {
    if (definition.value) problems.value = validateAll(definition.value)
  }, 250)
  watch(definition, () => void revalidate(), { immediate: true })

  function reset() {
    projectId.value = null
    definition.value = null
    serverDefinition.value = null
    changes.value = []
    problems.value = []
    queue.length = 0
  }

  return {
    projectId,
    definition,
    serverVersion,
    loading,
    loadError,
    sync,
    lastSavedAt,
    changes,
    problems,
    errorCount,
    ready,
    canUndo,
    canRedo,
    load,
    get,
    apply,
    undo,
    redo,
    refreshChanges,
    reset,
  }
})
