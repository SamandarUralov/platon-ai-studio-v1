/** Logic runtime endpoints (requirements §6.1): tests, runs, history, queue messages, stats. */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type {
  LogicHistoryEntry,
  LogicKind,
  LogicRun,
  LogicStatsResponse,
  LogicTestRequest,
  LogicTestResponse,
  QueueMessage,
} from '@platon/definition'
import { http } from '@/services/http'

const base = (pid: string) => `/projects/${pid}/logic`

export const logicKeys = {
  stats: (pid: string) => ['logic', pid, 'stats'] as const,
  runs: (pid: string, kind: LogicKind, id: string) => ['logic', pid, kind, id, 'runs'] as const,
  history: (pid: string, kind: LogicKind, id: string) => ['logic', pid, kind, id, 'history'] as const,
  messages: (pid: string, id: string) => ['logic', pid, 'queues', id, 'messages'] as const,
}

export function useLogicStats(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => logicKeys.stats(toValue(pid))),
    queryFn: async () => (await http.get<LogicStatsResponse>(`${base(toValue(pid))}/stats`)).data,
    enabled: computed(() => !!toValue(pid)),
    staleTime: 15_000,
  })
}

export function useRuns(
  pid: MaybeRefOrGetter<string>,
  kind: MaybeRefOrGetter<LogicKind>,
  id: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => logicKeys.runs(toValue(pid), toValue(kind), toValue(id))),
    queryFn: async () =>
      (await http.get<{ items: LogicRun[] }>(`${base(toValue(pid))}/${toValue(kind)}/${toValue(id)}/runs`))
        .data.items,
    enabled: computed(() => !!toValue(id)),
  })
}

export function useHistory(
  pid: MaybeRefOrGetter<string>,
  kind: MaybeRefOrGetter<LogicKind>,
  id: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => logicKeys.history(toValue(pid), toValue(kind), toValue(id))),
    queryFn: async () =>
      (
        await http.get<{ items: LogicHistoryEntry[] }>(
          `${base(toValue(pid))}/${toValue(kind)}/${toValue(id)}/history`,
        )
      ).data.items,
    enabled: computed(() => !!toValue(id)),
  })
}

export function useQueueMessages(pid: MaybeRefOrGetter<string>, id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => logicKeys.messages(toValue(pid), toValue(id))),
    queryFn: async () =>
      (await http.get<{ items: QueueMessage[] }>(`${base(toValue(pid))}/queues/${toValue(id)}/messages`)).data
        .items,
    enabled: computed(() => !!toValue(id)),
  })
}

/** Test a function / API, or run a cron now. `verb` is the action suffix (`test` / `run`). */
export function useTestRun(pid: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      kind: 'functions' | 'apis' | 'crons'
      id: string
      verb: 'test' | 'run'
      req: LogicTestRequest
    }) =>
      (await http.post<LogicTestResponse>(`${base(toValue(pid))}/${v.kind}/${v.id}:${v.verb}`, v.req)).data,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: logicKeys.runs(toValue(pid), v.kind, v.id) })
      void qc.invalidateQueries({ queryKey: logicKeys.stats(toValue(pid)) })
    },
  })
}

export function useQueueActions(pid: MaybeRefOrGetter<string>, id: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  const url = () => `${base(toValue(pid))}/queues/${toValue(id)}`
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: logicKeys.messages(toValue(pid), toValue(id)) })
    void qc.invalidateQueries({ queryKey: logicKeys.stats(toValue(pid)) })
  }
  const send = useMutation({
    mutationFn: async () => (await http.post<QueueMessage>(`${url()}:send`, {})).data,
    onSuccess: refresh,
  })
  const replay = useMutation({
    mutationFn: async (mid: string) =>
      (await http.post<QueueMessage>(`${url()}/messages/${mid}:replay`, {})).data,
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (mid: string) => void (await http.delete(`${url()}/messages/${mid}`)),
    onSuccess: refresh,
  })
  const replayDead = useMutation({
    mutationFn: async () => (await http.post<{ replayed: number }>(`${url()}:replayDead`, {})).data,
    onSuccess: refresh,
  })
  return { send, replay, remove, replayDead }
}
