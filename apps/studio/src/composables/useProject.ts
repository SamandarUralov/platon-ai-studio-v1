/** Current project id from the route + helpers to build Studio links. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { LogicKind } from '@platon/definition'

export function useProjectId() {
  const route = useRoute()
  return computed(() => String(route.params.projectId ?? ''))
}

export function projectLinks(projectId: string) {
  const p = { projectId }
  return {
    interface: (pageId?: string) => ({ name: 'interface', params: { ...p, pageId } }),
    logic: (kind?: LogicKind, itemId?: string) => ({ name: 'logic', params: { ...p, kind, itemId } }),
    data: (connId?: string, tableId?: string) => ({ name: 'data', params: { ...p, connId, tableId } }),
    storage: (kind?: 'object' | 'local', itemId?: string) => ({
      name: 'storage',
      params: { ...p, kind, itemId },
    }),
    preview: (pageId?: string) => ({ name: 'preview', params: { ...p, pageId } }),
    releases: () => ({ name: 'releases', params: p }),
    advanced: () => ({ name: 'advanced', params: p }),
    components: (componentId?: string) => ({ name: 'components', params: { ...p, componentId } }),
    settings: (section?: string) => ({ name: 'settings', params: { ...p, section } }),
  }
}
