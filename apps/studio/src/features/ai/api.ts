/** Studio AI endpoints (requirements §6.1). Chat replies stream over POST + SSE. */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source'
import {
  API_BASE,
  type AiContextInfo,
  type AiConversation,
  type AiConversationsResponse,
  type AiPlanActionResponse,
  type AiStreamEvent,
  type ApiErrorBody,
  type SendAiMessageRequest,
} from '@platon/definition'
import { ApiError, http } from '@/services/http'
import { auth } from '@/services/auth'
import { parseAiEvent } from './sse'

const enc = encodeURIComponent
const base = (pid: string) => `/projects/${enc(pid)}/ai`

export const aiKeys = {
  conversations: (pid: string) => ['ai', pid, 'conversations'] as const,
  context: (pid: string) => ['ai', pid, 'context'] as const,
}

export function useAiConversations(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => aiKeys.conversations(toValue(pid))),
    queryFn: async () =>
      (await http.get<AiConversationsResponse>(`${base(toValue(pid))}/conversations`)).data.items,
    enabled: computed(() => !!toValue(pid)),
    staleTime: 10_000,
  })
}

export function useAiContextInfo(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => aiKeys.context(toValue(pid))),
    queryFn: async () => (await http.get<AiContextInfo>(`${base(toValue(pid))}/context`)).data,
    enabled: computed(() => !!toValue(pid)),
    staleTime: 5 * 60_000,
  })
}

export const aiApi = {
  create: async (pid: string) => (await http.post<AiConversation>(`${base(pid)}/conversations`, {})).data,
  get: async (pid: string, cid: string) =>
    (await http.get<AiConversation>(`${base(pid)}/conversations/${enc(cid)}`)).data,
  apply: async (pid: string, planId: string, itemIds: string[]) =>
    (await http.post<AiPlanActionResponse>(`${base(pid)}/plans/${enc(planId)}:apply`, { itemIds })).data,
  discard: async (pid: string, planId: string) =>
    (await http.post<AiPlanActionResponse>(`${base(pid)}/plans/${enc(planId)}:discard`, {})).data,
}

/** Thrown out of fetch-event-source callbacks to stop its automatic retry. */
class FatalStreamError extends Error {}

/**
 * Send a message and stream the reply. Resolves when the stream ends (done, error or abort).
 * Aborting `signal` closes the connection; the server keeps what was streamed so far.
 */
export async function streamAiMessage(
  pid: string,
  cid: string,
  req: SendAiMessageRequest,
  onEvent: (e: AiStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const token = await auth.getToken()
  const url = `${import.meta.env.VITE_API_URL ?? ''}${API_BASE}${base(pid)}/conversations/${enc(cid)}/messages`
  await fetchEventSource(url, {
    method: 'POST',
    signal,
    openWhenHidden: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: EventStreamContentType,
      'Idempotency-Key': crypto.randomUUID?.() ?? String(Date.now()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
    async onopen(res) {
      if (res.ok && res.headers.get('content-type')?.startsWith(EventStreamContentType)) return
      let b: Partial<ApiErrorBody> = {}
      try {
        b = (await res.json()) as ApiErrorBody
      } catch {
        // non-JSON error body
      }
      if (res.status === 401) auth.onUnauthorized()
      throw new ApiError(
        res.status,
        b.error ?? 'http_error',
        b.message ?? `Studio AI is unavailable (${res.status})`,
        b.details ?? [],
      )
    },
    onmessage(ev) {
      const e = parseAiEvent(ev.event, ev.data)
      if (e) onEvent(e)
    },
    onerror(err: unknown) {
      // No silent retries: a retried POST would ask the model twice.
      throw err instanceof Error ? err : new FatalStreamError('Connection to Studio AI was lost')
    },
  })
}
