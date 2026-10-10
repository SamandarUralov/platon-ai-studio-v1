/** Server state for project settings that live outside the definition (TanStack Query). */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from '@platon/ui'
import type { AgentDoc, AuthSettings, CiResponse, GitResponse, Member } from '@platon/definition'
import { errorMessage, http } from '@/services/http'

export const settingsKeys = {
  auth: (pid: string) => ['settings', pid, 'auth'] as const,
  git: (pid: string) => ['settings', pid, 'git'] as const,
  ci: (pid: string) => ['settings', pid, 'ci'] as const,
  agent: (pid: string) => ['settings', pid, 'agent'] as const,
  members: (pid: string) => ['members', pid] as const,
}

const get = async <T>(url: string) => (await http.get<T>(url)).data

export function useAuthSettings(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => settingsKeys.auth(toValue(pid))),
    queryFn: () => get<AuthSettings>(`/projects/${toValue(pid)}/auth`),
  })
}

export function useGit(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => settingsKeys.git(toValue(pid))),
    queryFn: () => get<GitResponse>(`/projects/${toValue(pid)}/git`),
  })
}

export function useCi(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => settingsKeys.ci(toValue(pid))),
    queryFn: () => get<CiResponse>(`/projects/${toValue(pid)}/ci`),
    // Poll only while a run is in flight.
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === 'running') ? 1500 : false),
  })
}

export function useAgentDoc(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => settingsKeys.agent(toValue(pid))),
    queryFn: () => get<AgentDoc>(`/projects/${toValue(pid)}/agent`),
  })
}

export function useMembers(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => settingsKeys.members(toValue(pid))),
    queryFn: async () => (await get<{ items: Member[] }>(`/projects/${toValue(pid)}/members`)).items,
  })
}

/**
 * Mutation whose response replaces the cached query data (the settings endpoints return the whole
 * resource), with a toast on failure.
 */
export function useResourceMutation<V, R>(
  key: () => readonly unknown[],
  fn: (v: V) => Promise<R>,
  opts: { success?: (r: R, v: V) => string | void } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (r !== undefined) qc.setQueryData(key(), r)
      const msg = opts.success?.(r, v)
      if (msg) toast(msg, { tone: 'ok' })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
  })
}
