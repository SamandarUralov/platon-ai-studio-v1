/**
 * Community elements in the palette: components other teams published. Installing one copies its
 * source into this project's sandbox (server) and adds it to the definition as a reviewable change.
 */
import { computed, reactive, ref, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type {
  CommunityComponent,
  CommunityComponentsResponse,
  CustomComponent,
  InstallCommunityComponentResponse,
} from '@platon/definition'
import { http } from '@/services/http'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'

export function useCommunityComponents(q: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['community', 'components', q.value.trim().toLowerCase()]),
    queryFn: async () =>
      (
        await http.get<CommunityComponentsResponse>('/community/components', {
          params: { q: q.value.trim() || undefined },
        })
      ).data.items,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  })
}

/** Community id → installed component id, per project, so a second add reuses the copy. */
const installed = reactive(new Map<string, string>())

export function useCommunityInstall() {
  const def = useDefinitionStore()
  const pid = useProjectId()
  const installing = ref<string | null>(null)
  const key = (c: CommunityComponent) => `${pid.value}/${c.id}`

  /** The project's copy of `c`, while it is still in the definition. */
  function copyOf(c: CommunityComponent): CustomComponent | undefined {
    const id = installed.get(key(c))
    return id ? def.definition?.components.find((x) => x.id === id) : undefined
  }

  async function install(c: CommunityComponent): Promise<CustomComponent | null> {
    const existing = copyOf(c)
    if (existing) return existing
    installing.value = c.id
    try {
      const { component } = (
        await http.post<InstallCommunityComponentResponse>(
          `/projects/${pid.value}/components/community/${encodeURIComponent(c.id)}/install`,
          {},
        )
      ).data
      const ok = def.apply({
        key: `components.${component.id.replace(/^component:/, '')}`,
        area: 'Components',
        text: `Installed “${component.name}” from the community`,
        ops: [{ op: 'add', path: '/components/-', value: component }],
      })
      if (!ok) return null
      installed.set(key(c), component.id)
      return component
    } finally {
      installing.value = null
    }
  }

  return { install, installing, copyOf }
}
