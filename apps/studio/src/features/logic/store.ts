/** UI state of the Logic layer editor (selection, views, drag, test results). Not part of the definition. */
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { LogicKind, LogicTestResponse, StepType } from '@platon/definition'

export type BuilderView = 'builder' | 'flow' | 'json'
export type ApiTab = 'api' | 'cache' | 'problems' | 'test' | 'runs' | 'history'
export type QueueTab = 'flow' | 'messages' | 'settings'

/** What is being dragged. Kept here because native DnD can't carry objects across components. */
export type DragPayload =
  | { kind: 'new'; type: StepType; config?: Record<string, string> }
  | { kind: 'move'; stepId: string }
  | { kind: 'item'; itemKind: LogicKind; id: string }
  | { kind: 'pkg'; itemKind: LogicKind; id: string }

export interface StoredTest {
  res: LogicTestResponse
  /** Steps JSON at run time — shows "layers changed since this run". */
  sig: string
}

export const useLogicEditor = defineStore('logic-editor', () => {
  /** Selected layer per item path. */
  const selected = ref<Record<string, string | null>>({})
  const view = ref<Record<string, BuilderView>>({})
  const rightTab = ref<'layer' | 'ai'>('layer')
  const apiTab = ref<ApiTab>('api')
  const queueTab = ref<QueueTab>('flow')
  const testOpen = ref<Record<string, boolean>>({})
  const testInputs = ref<Record<string, Record<string, string>>>({})
  const tests = shallowRef<Record<string, StoredTest>>({})
  const collapsed = ref<Record<string, string[]>>({})
  const drag = shallowRef<DragPayload | null>(null)
  const openGroups = useLocalStorage<Record<string, boolean>>('platon.logic.groups', {})
  const openPkgs = useLocalStorage<string[]>('platon.logic.pkgs', [])

  function select(path: string, stepId: string | null) {
    selected.value = { ...selected.value, [path]: stepId }
    if (stepId) {
      rightTab.value = 'layer'
      apiTab.value = 'api'
    }
  }

  function toggleCollapsed(path: string, stepId: string) {
    const cur = collapsed.value[path] ?? []
    collapsed.value = {
      ...collapsed.value,
      [path]: cur.includes(stepId) ? cur.filter((x) => x !== stepId) : [...cur, stepId],
    }
  }

  function setTest(path: string, t: StoredTest | null) {
    const next = { ...tests.value }
    if (t) next[path] = t
    else delete next[path]
    tests.value = next
  }

  function togglePkg(id: string, open?: boolean) {
    const has = openPkgs.value.includes(id)
    const want = open ?? !has
    if (want && !has) openPkgs.value = [...openPkgs.value, id]
    if (!want && has) openPkgs.value = openPkgs.value.filter((x) => x !== id)
  }

  return {
    selected,
    view,
    rightTab,
    apiTab,
    queueTab,
    testOpen,
    testInputs,
    tests,
    collapsed,
    drag,
    openGroups,
    openPkgs,
    select,
    toggleCollapsed,
    setTest,
    togglePkg,
  }
})
