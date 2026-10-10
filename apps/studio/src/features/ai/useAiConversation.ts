/**
 * Studio AI conversation state for one project: the open chat, streaming, plans and diffs.
 *
 * State is kept per project at module level so the chat survives switching layers (every layer
 * mounts its own AiPanel). Server lists (history) stay in TanStack Query.
 *
 * AI only proposes: a plan changes the definition only when the user applies it, and then through
 * `useDefinitionStore().apply(…, { authorKind: 'ai' })` like any other edit.
 */
import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from '@platon/ui'
import type {
  AiChip,
  AiMessage,
  AiModel,
  AiPlan,
  AiStreamEvent,
  SendAiMessageRequest,
} from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { errorMessage } from '@/services/http'
import { aiApi, aiKeys, streamAiMessage } from './api'
import { applyAiEvent } from './sse'
import { planToChanges } from './plan'
import type { AiContext } from './types'

interface ConvState {
  conversationId: string | null
  title: string
  messages: AiMessage[]
  /** Waiting for the first token. */
  thinking: boolean
  streaming: boolean
  loading: boolean
  model: AiModel
  /** planId → checked item ids (UI state, pending plans only). */
  checked: Record<string, string[]>
  /** plan/diff ids with a request in flight */
  busy: Record<string, boolean>
  /** Human changes after this time are "unseen" by the assistant. */
  seenAt: string
  abort: AbortController | null
}

const states = new Map<string, ConvState>()

function stateFor(pid: string): ConvState {
  let s = states.get(pid)
  if (!s) {
    s = reactive<ConvState>({
      conversationId: null,
      title: '',
      messages: [],
      thinking: false,
      streaming: false,
      loading: false,
      model: 'claude',
      checked: {},
      busy: {},
      seenAt: new Date().toISOString(),
      abort: null,
    }) as ConvState
    states.set(pid, s)
  }
  return s
}

/** Test hook: forget all per-project chat state. */
export function resetAiState() {
  for (const s of states.values()) s.abort?.abort()
  states.clear()
}

export function useAiConversation(projectId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  const defs = useDefinitionStore()
  const pid = computed(() => toValue(projectId))
  const st = computed(() => stateFor(pid.value))

  const invalidate = () => qc.invalidateQueries({ queryKey: aiKeys.conversations(pid.value) })

  /** Human edits the assistant hasn't seen yet (shown above the composer, sent with the prompt). */
  const unseen = computed(() =>
    defs.changes.filter((c) => c.authorKind !== 'ai' && !c.releaseId && c.createdAt > st.value.seenAt),
  )

  function patchMessage(id: string, fn: (m: AiMessage) => AiMessage) {
    const s = st.value
    s.messages = s.messages.map((m) => (m.id === id ? fn(m) : m))
  }

  function initChecked(plan: AiPlan | undefined) {
    if (plan?.status === 'pending' && !st.value.checked[plan.id])
      st.value.checked[plan.id] = plan.items.map((i) => i.id)
  }

  function newChat() {
    const s = st.value
    s.abort?.abort()
    s.conversationId = null
    s.title = ''
    s.messages = []
    s.thinking = false
    s.streaming = false
  }

  async function open(cid: string) {
    const s = st.value
    if (s.conversationId === cid) return
    s.abort?.abort()
    s.loading = true
    try {
      const c = await aiApi.get(pid.value, cid)
      s.conversationId = c.id
      s.title = c.title
      s.messages = c.messages
      c.messages.forEach((m) => initChecked(m.plan))
    } catch (e) {
      toast(errorMessage(e), { tone: 'danger' })
    } finally {
      s.loading = false
    }
  }

  async function send(input: {
    text: string
    chips: AiChip[]
    context?: AiContext | null
    namingFor?: string
  }): Promise<boolean> {
    const s = st.value
    const text = input.text.trim()
    if ((!text && !input.chips.length) || s.streaming) return false
    const project = pid.value

    const skill = input.chips.find((c) => c.kind === 'skill')
    const now = new Date().toISOString()
    const tmpUser: AiMessage = {
      id: `tmp_u_${Date.now()}`,
      role: 'user',
      text: text || skill?.label || 'Use this context',
      createdAt: now,
      chips: input.chips,
    }
    let aiId = `tmp_a_${Date.now()}`
    const draft: AiMessage = { id: aiId, role: 'assistant', text: '', createdAt: now }
    s.messages = [...s.messages, tmpUser, draft]
    s.thinking = true
    s.streaming = true
    const recentEdits = unseen.value.map((c) => c.text).slice(-5)
    s.seenAt = now
    const ctrl = new AbortController()
    s.abort = ctrl

    const req: SendAiMessageRequest = {
      text,
      chips: input.chips,
      context: input.context ?? null,
      model: s.model,
      recentEdits,
      ...(input.namingFor ? { namingFor: input.namingFor } : {}),
    }
    try {
      if (!s.conversationId) {
        const c = await aiApi.create(project)
        if (ctrl.signal.aborted) return false
        s.conversationId = c.id
      }
      const cid = s.conversationId
      let failed: string | null = null
      await streamAiMessage(
        project,
        cid,
        req,
        (e: AiStreamEvent) => {
          if (st.value.conversationId !== cid) return
          if (e.type === 'start') {
            s.title = e.title
            patchMessage(tmpUser.id, () => e.userMessage)
          }
          if (e.type === 'error') failed = e.message
          if (e.type !== 'start' && e.type !== 'error') s.thinking = false
          if (e.type === 'component' && input.namingFor) {
            // The picker this reply answers is now settled.
            patchMessage(input.namingFor, (m) =>
              m.naming ? { ...m, naming: { ...m.naming, status: 'done', picked: e.component.name } } : m,
            )
          }
          const prev = aiId
          patchMessage(prev, (m) => {
            const next = applyAiEvent(m, e)
            aiId = next.id
            return next
          })
          if (e.type === 'plan' || e.type === 'done') initChecked(e.type === 'plan' ? e.plan : e.message.plan)
        },
        ctrl.signal,
      )
      if (failed) throw new Error(failed)
      return true
    } catch (e) {
      if (ctrl.signal.aborted) return false
      // Keep what streamed; replace an empty bubble with the error.
      patchMessage(aiId, (m) => (m.text ? { ...m, stopped: true } : { ...m, text: `_${errorMessage(e)}_` }))
      toast(errorMessage(e), { tone: 'danger' })
      return false
    } finally {
      if (s.abort === ctrl) s.abort = null
      s.thinking = false
      s.streaming = false
      void invalidate()
    }
  }

  function stop() {
    const s = st.value
    if (!s.abort) return
    s.abort.abort()
    s.abort = null
    s.thinking = false
    s.streaming = false
    const last = s.messages.at(-1)
    if (last?.role === 'assistant') {
      if (!last.text && !last.plan) s.messages = s.messages.slice(0, -1)
      else patchMessage(last.id, (m) => ({ ...m, stopped: true }))
    }
  }

  function toggleItem(planId: string, itemId: string) {
    const cur = st.value.checked[planId] ?? []
    st.value.checked[planId] = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]
  }

  async function applyPlan(messageId: string): Promise<boolean> {
    const s = st.value
    const msg = s.messages.find((m) => m.id === messageId)
    const plan = msg?.plan
    if (!plan || plan.status !== 'pending' || s.busy[plan.id]) return false
    const checked = new Set(s.checked[plan.id] ?? [])
    const changes = planToChanges(plan, checked)
    if (!changes.length) return false
    // The store applies all or nothing and toasts the reason when an op no longer fits.
    if (!defs.apply(changes, { authorKind: 'ai' })) return false
    s.seenAt = new Date().toISOString()
    const optimistic: AiPlan = {
      ...plan,
      status: 'applied',
      items: plan.items.map((i) => ({ ...i, status: checked.has(i.id) ? 'applied' : 'skipped' })),
    }
    patchMessage(messageId, (m) => ({ ...m, plan: optimistic }))
    s.busy[plan.id] = true
    try {
      const res = await aiApi.apply(pid.value, plan.id, [...checked])
      if (res.plan) patchMessage(messageId, (m) => ({ ...m, plan: res.plan }))
      if (res.message && s.conversationId) s.messages = [...s.messages, res.message]
    } catch (e) {
      toast(`Changes applied, but the plan status wasn’t saved: ${errorMessage(e)}`, { tone: 'warn' })
    } finally {
      delete s.busy[plan.id]
      void invalidate()
    }
    return true
  }

  async function discardPlan(messageId: string) {
    const s = st.value
    const plan = s.messages.find((m) => m.id === messageId)?.plan
    if (!plan || plan.status !== 'pending' || s.busy[plan.id]) return
    patchMessage(messageId, (m) => ({
      ...m,
      plan: { ...plan, status: 'discarded', items: plan.items.map((i) => ({ ...i, status: 'skipped' })) },
    }))
    s.busy[plan.id] = true
    try {
      await aiApi.discard(pid.value, plan.id)
    } catch (e) {
      toast(errorMessage(e), { tone: 'danger' })
    } finally {
      delete s.busy[plan.id]
      void invalidate()
    }
  }

  async function applyDiff(messageId: string, apply: boolean) {
    const s = st.value
    const diff = s.messages.find((m) => m.id === messageId)?.diff
    if (!diff || diff.status !== 'pending' || s.busy[diff.id]) return
    if (apply && !defs.apply(diff.change, { authorKind: 'ai' })) return
    patchMessage(messageId, (m) => ({ ...m, diff: { ...diff, status: apply ? 'applied' : 'discarded' } }))
    s.busy[diff.id] = true
    try {
      await (apply ? aiApi.apply(pid.value, diff.id, []) : aiApi.discard(pid.value, diff.id))
    } catch (e) {
      if (!apply) toast(errorMessage(e), { tone: 'danger' })
    } finally {
      delete s.busy[diff.id]
      void invalidate()
    }
  }

  return {
    state: st,
    unseen,
    newChat,
    open,
    send,
    stop,
    toggleItem,
    applyPlan,
    discardPlan,
    applyDiff,
  }
}

export type AiConversationApi = ReturnType<typeof useAiConversation>
