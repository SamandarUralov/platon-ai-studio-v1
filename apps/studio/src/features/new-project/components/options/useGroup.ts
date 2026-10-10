import { computed, type Ref } from 'vue'
import type { GroupDef } from '../../catalog'
import { useFlow } from '../../flow'

/** Selection helpers shared by the option renderers. */
export function useGroup(group: Ref<GroupDef>) {
  const flow = useFlow()
  const current = computed(() => flow.state.sel[group.value.key])
  function selected(id: string): boolean {
    // A free-text answer replaces the structured one, so nothing looks picked while it is set.
    if (flow.state.custom.trim()) return false
    const v = current.value
    return group.value.multi ? Array.isArray(v) && v.includes(id) : v === id
  }
  const pick = (id: string) => flow.pick(group.value.key, id)
  const role = computed(() => (group.value.multi ? 'checkbox' : 'radio'))
  return { flow, selected, pick, role }
}
