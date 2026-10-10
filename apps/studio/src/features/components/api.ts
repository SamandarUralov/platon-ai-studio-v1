/** Server state for custom components: sandbox files, constructor sessions and AI generation. */
import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type {
  ComponentSessionResponse,
  GenerateComponentRequest,
  GenerateComponentResponse,
  SandboxFileContent,
  SandboxFilesResponse,
  SaveSandboxFileRequest,
} from '@platon/definition'
import { http } from '@/services/http'

export const componentKeys = {
  files: (pid: string) => ['components', pid, 'sandbox-files'] as const,
  file: (pid: string, path: string) => ['components', pid, 'sandbox-file', path] as const,
}

export function useSandboxFiles(pid: Ref<string>) {
  return useQuery({
    queryKey: computed(() => componentKeys.files(pid.value)),
    queryFn: async () =>
      (await http.get<SandboxFilesResponse>(`/projects/${pid.value}/components/sandbox/files`)).data.items,
    enabled: computed(() => !!pid.value),
  })
}

export function useSandboxFile(pid: Ref<string>, path: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => componentKeys.file(pid.value, path.value ?? '')),
    queryFn: async () =>
      (
        await http.get<SandboxFileContent>(`/projects/${pid.value}/components/sandbox/file`, {
          params: { path: path.value },
        })
      ).data,
    enabled: computed(() => !!pid.value && !!path.value),
    retry: false,
    // The editor keeps its own draft; don't clobber it with background refetches.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export async function saveSandboxFile(
  pid: string,
  path: string,
  req: SaveSandboxFileRequest,
): Promise<SandboxFileContent> {
  return (
    await http.put<SandboxFileContent>(`/projects/${pid}/components/sandbox/file`, req, { params: { path } })
  ).data
}

export async function createComponentSession(
  pid: string,
  shortId: string,
): Promise<ComponentSessionResponse> {
  return (await http.post<ComponentSessionResponse>(`/projects/${pid}/components/${shortId}/session`, {}))
    .data
}

export async function generateComponent(
  pid: string,
  req: GenerateComponentRequest,
): Promise<GenerateComponentResponse> {
  return (await http.post<GenerateComponentResponse>(`/projects/${pid}/components/generate`, req)).data
}
