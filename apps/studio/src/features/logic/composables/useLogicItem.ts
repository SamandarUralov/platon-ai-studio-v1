/**
 * Draft-backed access to one Logic item (requirements §3.3 "Saving"): edits stay local until
 * ⌘S, which writes one `replace /logic/<kind>/<id>` change.
 */
import { computed, markRaw, toValue, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'
import type { LogicKind, Problem, Step } from '@platon/definition'
import { problemsUnder, validateLogic } from '@platon/validators'
import { toast } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { useDraftsStore } from '@/stores/drafts'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { itemTitle, KIND_NOUN } from '../lib/items'
import type { LogicItem } from '../lib/nav'

export const itemPath = (kind: LogicKind, id: string) => `/logic/${kind}/${id}`

export function useLogicItem<T extends LogicItem = LogicItem>(
  kind: MaybeRefOrGetter<LogicKind>,
  id: MaybeRefOrGetter<string>,
) {
  const def = useDefinitionStore()
  const drafts = useDraftsStore()
  const router = useRouter()
  const pid = useProjectId()

  const path = computed(() => itemPath(toValue(kind), toValue(id)))
  const item = computed(() => drafts.value<T>(path.value))
  const saved = computed(() => def.get<T>(path.value))
  const dirty = computed(() => drafts.isDirty(path.value))
  /** Live problems: the saved definition's, or the draft's while it has unsaved edits. */
  const problems = computed<Problem[]>(() => {
    const d = def.definition
    const it = item.value
    if (!dirty.value || !d || !it) return problemsUnder(def.problems, path.value)
    const k = toValue(kind)
    const list = (d.logic[k] as LogicItem[]).map((x) => (x.id === it.id ? it : x))
    return problemsUnder(validateLogic({ ...d, logic: { ...d.logic, [k]: list } }), path.value)
  })

  /**
   * The draft is stored raw: the drafts store deep-clones the current value on every edit and a
   * reactive proxy can't be structured-cloned. Whole-value replacement keeps it reactive anyway.
   */
  function edit(fn: (x: T) => T) {
    drafts.edit<T>(path.value, (x) => markRaw(fn(x)))
  }

  function editSteps(fn: (steps: Step[]) => Step[]) {
    edit((x) => ({ ...x, steps: fn((x as { steps?: Step[] }).steps ?? []) }) as T)
  }

  function save() {
    const it = item.value
    if (!it || !dirty.value) return
    const k = toValue(kind)
    const ok = drafts.save(path.value, {
      key: `logic.${k}.${toValue(id)}`,
      area: 'Logic',
      text: `Edited ${KIND_NOUN[k]} “${itemTitle(k, it)}”`,
    })
    if (ok) toast(`Saved ${itemTitle(k, it)}`, { tone: 'ok' })
  }

  function discard() {
    drafts.discard(path.value)
  }

  /** Delete the item (direct change, not a draft) and move to the group overview. */
  function remove() {
    const it = saved.value
    const k = toValue(kind)
    if (!it) return
    drafts.discard(path.value)
    if (
      def.apply({
        key: `logic.${k}.${it.id}.delete`,
        area: 'Logic',
        text: `Deleted ${KIND_NOUN[k]} “${itemTitle(k, it)}”`,
        ops: [{ op: 'remove', path: path.value }],
      })
    )
      void router.push(projectLinks(pid.value).logic(k))
  }

  return { path, item, saved, dirty, problems, edit, editSteps, save, discard, remove }
}
