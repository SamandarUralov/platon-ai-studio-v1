/** Console dock server calls: tests and the Development shell. */
import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import type {
  RunTestsRequest,
  RunTestsResponse,
  ShellCallRequest,
  ShellCallResponse,
  ShellQueryRequest,
  ShellQueryResponse,
  TestsResponse,
} from '@platon/definition'
import { http } from '@/services/http'

export function useTestCases(projectId: Ref<string | null>) {
  return useQuery({
    queryKey: ['tests', projectId],
    queryFn: async () => (await http.get<TestsResponse>(`/projects/${projectId.value}/tests`)).data.items,
    enabled: () => !!projectId.value,
    staleTime: 60_000,
  })
}

export async function runTests(projectId: string, req: RunTestsRequest): Promise<RunTestsResponse> {
  return (await http.post<RunTestsResponse>(`/projects/${projectId}/test-runs`, req)).data
}

export async function shellCall(projectId: string, req: ShellCallRequest): Promise<ShellCallResponse> {
  return (await http.post<ShellCallResponse>(`/projects/${projectId}/shell/call`, req)).data
}

export async function shellQuery(projectId: string, req: ShellQueryRequest): Promise<ShellQueryResponse> {
  return (await http.post<ShellQueryResponse>(`/projects/${projectId}/shell/query`, req)).data
}
