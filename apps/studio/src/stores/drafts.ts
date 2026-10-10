/**
 * Draft model for Logic items and page scripts (requirements §3.3 "Saving").
 * The first edit snapshots the item; edits stay local until saved (⌘S), which writes a single
 * change `replace <path>`. Discard restores the snapshot.
 *
 * Drafts live in a shallowRef of plain objects (never reactive proxies) so they can be cloned,
 * compared and sent as-is; every update replaces the record to trigger reactivity.
 */
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'
import { cloneJson, type ChangeArea } from '@platon/definition'
import { useDefinitionStore } from './definition'

interface Draft {
  base: unknown
  value: unknown
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const useDraftsStore = defineStore('drafts', () => {
  const def = useDefinitionStore()
  const drafts = shallowRef<Record<string, Draft>>({})

  watch(
    () => def.projectId,
    () => (drafts.value = {}),
  )

  function value<T>(path: string): T | undefined {
    const d = drafts.value[path]
    return (d ? d.value : def.get(path)) as T | undefined
  }

  function set(path: string, d: Draft | null) {
    const next = { ...drafts.value }
    if (d) next[path] = d
    else delete next[path]
    drafts.value = next
  }

  /** `fn` receives a private deep copy it may mutate or replace. */
  function edit<T>(path: string, fn: (current: T) => T) {
    const current = value<T>(path)
    if (current === undefined) return
    const base = drafts.value[path]?.base ?? def.get(path)
    const next = cloneJson(fn(cloneJson(current)))
    set(path, same(base, next) ? null : { base, value: next })
  }

  function isDirty(path: string): boolean {
    return path in drafts.value
  }

  function save(path: string, meta: { key: string; area: ChangeArea; text: string }): boolean {
    const d = drafts.value[path]
    if (!d) return true
    const ok = def.apply({
      ...meta,
      machinePath: `~ ${meta.key}`,
      ops: [{ op: 'replace', path, value: d.value }],
    })
    if (ok) set(path, null)
    return ok
  }

  function discard(path: string) {
    set(path, null)
  }

  const dirtyPaths = computed(() => Object.keys(drafts.value))

  return { drafts, value, edit, isDirty, save, discard, dirtyPaths }
})
