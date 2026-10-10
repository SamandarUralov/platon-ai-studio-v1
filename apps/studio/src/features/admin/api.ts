/** Server state for the Admin panel (TanStack Query). Every admin endpoint returns the whole resource. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from '@platon/ui'
import type {
  AdminModuleGroup,
  AdminOverview,
  AdminProject,
  AdminRolesResponse,
  AdminStudioSettings,
  AdminUser,
  AiSettings,
  AuditEntry,
  DatabasesResponse,
  Sandbox,
} from '@platon/definition'
import { errorMessage, http } from '@/services/http'

export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  studio: ['admin', 'studio'] as const,
  users: ['admin', 'users'] as const,
  roles: ['admin', 'roles'] as const,
  projects: ['admin', 'projects'] as const,
  ai: ['admin', 'ai'] as const,
  databases: ['admin', 'databases'] as const,
  sandboxes: ['admin', 'sandboxes'] as const,
  modules: ['admin', 'modules'] as const,
  audit: (area: string | null) => ['admin', 'audit', area ?? 'all'] as const,
}

const get = async <T>(url: string) => (await http.get<T>(url)).data

export const useOverview = () =>
  useQuery({ queryKey: adminKeys.overview, queryFn: () => get<AdminOverview>('/admin/overview') })
export const useStudio = () =>
  useQuery({ queryKey: adminKeys.studio, queryFn: () => get<AdminStudioSettings>('/admin/studio') })
export const useUsers = () =>
  useQuery({
    queryKey: adminKeys.users,
    queryFn: async () => (await get<{ items: AdminUser[] }>('/admin/users')).items,
  })
export const useRoles = () =>
  useQuery({ queryKey: adminKeys.roles, queryFn: () => get<AdminRolesResponse>('/admin/roles') })
export const useAdminProjects = () =>
  useQuery({
    queryKey: adminKeys.projects,
    queryFn: async () => (await get<{ items: AdminProject[] }>('/admin/projects')).items,
  })
export const useAi = () => useQuery({ queryKey: adminKeys.ai, queryFn: () => get<AiSettings>('/admin/ai') })
export const useDatabases = () =>
  useQuery({ queryKey: adminKeys.databases, queryFn: () => get<DatabasesResponse>('/admin/databases') })
export const useSandboxes = () =>
  useQuery({
    queryKey: adminKeys.sandboxes,
    queryFn: async () => (await get<{ items: Sandbox[] }>('/admin/sandboxes')).items,
  })
export const useModules = () =>
  useQuery({
    queryKey: adminKeys.modules,
    queryFn: async () => (await get<{ items: AdminModuleGroup[] }>('/admin/modules')).items,
  })

/**
 * Mutation that stores the returned resource under `key` (when given), refreshes the overview and audit
 * log (every admin change is audited), and toasts errors.
 */
export function useAdminMutation<V, R>(
  fn: (v: V) => Promise<R>,
  opts: {
    key?: readonly unknown[]
    set?: (r: R) => unknown
    success?: (r: R, v: V) => string | void
    invalidate?: (readonly unknown[])[]
  } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (opts.key) qc.setQueryData(opts.key, opts.set ? opts.set(r) : r)
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: k })
      void qc.invalidateQueries({ queryKey: adminKeys.overview })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
      const msg = opts.success?.(r, v)
      if (msg) toast(msg, { tone: 'ok' })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
  })
}

export type { AuditEntry }
