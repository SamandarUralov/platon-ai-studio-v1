/** Releases server state (TanStack Query) and commands. */
import { computed, type Ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type {
  CreateReleaseRequest,
  DeployResponse,
  EnvName,
  Release,
  ReleaseDetailResponse,
  ReleasePreviewResponse,
  ReleasesResponse,
  RollbackResponse,
} from '@platon/definition'
import { http } from '@/services/http'

export const releaseKeys = {
  all: (pid: string) => ['releases', pid] as const,
  preview: (pid: string) => ['releases', pid, 'preview'] as const,
  detail: (pid: string, rid: string) => ['releases', pid, 'detail', rid] as const,
  job: (pid: string, jobId: string) => ['releases', pid, 'job', jobId] as const,
}

export function useReleases(projectId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => releaseKeys.all(projectId.value)),
    queryFn: async () => (await http.get<ReleasesResponse>(`/projects/${projectId.value}/releases`)).data,
    enabled: () => !!projectId.value,
    // Keep env cards fresh while something is deploying.
    refetchInterval: (q) => (q.state.data?.environments.some((e) => e.status === 'running') ? 1500 : false),
  })
}

export function useReleasePreview(projectId: Ref<string>, enabled: Ref<boolean>) {
  return useQuery({
    queryKey: computed(() => releaseKeys.preview(projectId.value)),
    queryFn: async () =>
      (await http.get<ReleasePreviewResponse>(`/projects/${projectId.value}/releases/preview`)).data,
    enabled: () => !!projectId.value && enabled.value,
    staleTime: 0,
  })
}

export function useReleaseDetail(projectId: Ref<string>, releaseId: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => releaseKeys.detail(projectId.value, releaseId.value ?? '')),
    queryFn: async () =>
      (await http.get<ReleaseDetailResponse>(`/projects/${projectId.value}/releases/${releaseId.value}`))
        .data,
    enabled: () => !!projectId.value && !!releaseId.value,
  })
}

/** Poll a deployment job until it finishes. */
export function useDeploymentJob(projectId: Ref<string>, jobId: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => releaseKeys.job(projectId.value, jobId.value ?? '')),
    queryFn: async () =>
      (await http.get<DeployResponse>(`/projects/${projectId.value}/deployments/${jobId.value}`)).data.job,
    enabled: () => !!projectId.value && !!jobId.value,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'running' ? false : 600),
  })
}

export function useReleaseCommands(projectId: Ref<string>) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: releaseKeys.all(projectId.value) })
  return {
    invalidate,
    async create(req: CreateReleaseRequest): Promise<Release> {
      return (await http.post<Release>(`/projects/${projectId.value}/releases`, req)).data
    },
    async deploy(releaseId: string, env: EnvName) {
      const res = (
        await http.post<DeployResponse>(`/projects/${projectId.value}/releases/${releaseId}:deploy`, null, {
          params: { env },
        })
      ).data
      void invalidate()
      return res.job
    },
    async rollback(releaseId: string, env: EnvName) {
      const res = (
        await http.post<RollbackResponse>(
          `/projects/${projectId.value}/releases/${releaseId}:rollback`,
          null,
          { params: { env } },
        )
      ).data
      void invalidate()
      return res
    },
  }
}
