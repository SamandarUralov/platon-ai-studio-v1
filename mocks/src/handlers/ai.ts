/**
 * Mock handlers — Studio AI (requirements §6.1).
 * Conversations live in the project's `ext.ai` bucket; replies come from the scripted assistant in
 * seed/ai.ts and are streamed as SSE (`token` deltas, then `plan`/`diff`/`naming`/`component`, `done`).
 */
import { delay, http, HttpResponse, type HttpHandler } from 'msw'
import {
  newId,
  type AiContextInfo,
  type AiConversation,
  type AiConversationsResponse,
  type AiMessage,
  type AiPlanActionResponse,
  type AiStreamEvent,
  type ApplyAiPlanRequest,
  type SendAiMessageRequest,
} from '@platon/definition'
import { ext, persist } from '../db'
import { ME } from '../seed'
import { componentGen, scriptReply, seedConversations, summarize } from '../seed/ai'
import { action, api, body, fail, json, latency, withProject } from '../http'

interface AiState {
  conversations: AiConversation[]
}

const aiState = (pid: string) => ext<AiState>(pid, 'ai', () => ({ conversations: seedConversations() }))

const isTest = () => import.meta.env?.MODE === 'test'
const tick = (ms: number) => (isTest() ? Promise.resolve() : delay(ms))

function strip(c: AiConversation) {
  const { messages: _m, ...summary } = c
  return summary
}

function findTarget(st: AiState, id: string) {
  for (const c of st.conversations)
    for (const m of c.messages) {
      if (m.plan?.id === id) return { convo: c, message: m, kind: 'plan' as const }
      if (m.diff?.id === id) return { convo: c, message: m, kind: 'diff' as const }
    }
  return null
}

const frame = (e: AiStreamEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`

/** Split text into small chunks so the client sees a real token stream. */
function chunks(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? []
}

export const aiHandlers: HttpHandler[] = [
  http.get(api('/projects/:id/ai/context'), async ({ params }) => {
    await latency(60)
    return withProject(params.id, () =>
      json<AiContextInfo>({
        maxTokens: 200_000,
        systemTokens: 3_200,
        agentMdTokens: 1_450,
        models: [
          { id: 'claude', label: 'Claude' },
          { id: 'gpt', label: 'GPT' },
        ],
      }),
    )
  }),

  http.get(api('/projects/:id/ai/conversations'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => {
      const items = [...aiState(pid).conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(strip)
      return json<AiConversationsResponse>({ items })
    })
  }),

  http.post(api('/projects/:id/ai/conversations'), async ({ params }) => {
    await latency(80)
    return withProject(params.id, (_p, pid) => {
      const now = new Date().toISOString()
      const c = summarize({
        id: newId('conv'),
        title: '',
        createdAt: now,
        updatedAt: now,
        by: ME.name,
        messageCount: 0,
        appliedCount: 0,
        hasPendingPlan: false,
        snippet: '',
        messages: [],
      })
      aiState(pid).conversations.unshift(c)
      persist()
      return json<AiConversation>(c, { status: 201 })
    })
  }),

  http.get(api('/projects/:id/ai/conversations/:cid'), async ({ params }) => {
    await latency()
    return withProject(params.id, (_p, pid) => {
      const c = aiState(pid).conversations.find((x) => x.id === params.cid)
      return c ? json<AiConversation>(c) : fail(404, 'not_found', 'Conversation not found')
    })
  }),

  http.post(api('/projects/:id/ai/conversations/:cid/messages'), async ({ params, request }) => {
    const req = await body<SendAiMessageRequest>(request)
    return withProject(params.id, (p, pid) => {
      const st = aiState(pid)
      const ci = st.conversations.findIndex((x) => x.id === params.cid)
      if (ci < 0) return fail(404, 'not_found', 'Conversation not found')
      if (!req.text?.trim() && !req.chips?.length)
        return fail(400, 'validation', 'Write a message first', [{ path: 'text', problem: 'required' }])
      req.chips ??= []

      const convo = st.conversations[ci]!
      const now = new Date().toISOString()
      const skill = req.chips.find((c) => c.kind === 'skill')
      const userMsg: AiMessage = {
        id: newId('msg'),
        role: 'user',
        text: req.text.trim() || skill?.label || 'Use this context',
        createdAt: now,
        author: ME.name,
        chips: req.chips,
      }
      const reply = scriptReply(p.definition, req, convo)
      const answered =
        req.namingFor ??
        (reply.component
          ? [...convo.messages].reverse().find((m) => m.naming?.status === 'pending')?.id
          : undefined)
      const ai: AiMessage = {
        id: newId('msg'),
        role: 'assistant',
        text: '',
        createdAt: now,
        ...(reply.note ? { note: reply.note } : {}),
      }

      const save = (final: AiMessage) => {
        const cur = st.conversations.find((x) => x.id === convo.id)
        if (!cur) return
        let messages = [...cur.messages]
        if (answered && reply.component)
          messages = messages.map((m) =>
            m.id === answered && m.naming
              ? { ...m, naming: { ...m.naming, status: 'done', picked: reply.component!.name } }
              : m,
          )
        const next = summarize({
          ...cur,
          messages: [...messages, userMsg, final],
          updatedAt: new Date().toISOString(),
        })
        st.conversations = st.conversations.map((x) => (x.id === cur.id ? next : x))
        persist()
      }

      let cancelled = false
      const enc = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(ctrl) {
          const send = (e: AiStreamEvent) => {
            if (!cancelled) ctrl.enqueue(enc.encode(frame(e)))
          }
          send({
            type: 'start',
            userMessage: userMsg,
            messageId: ai.id,
            title: convo.messages.length ? convo.title : summarize({ ...convo, messages: [userMsg] }).title,
          })
          // "Reading your app definition…" before the first token (§7: first token < 2 s).
          await tick(700)
          if (reply.note) send({ type: 'note', text: reply.note })
          for (const c of chunks(reply.text)) {
            if (cancelled) break
            ai.text += c
            send({ type: 'token', text: c })
            await tick(28)
          }
          if (!cancelled && reply.component) {
            const folder = reply.component.file.includes('/pages/') ? 'pages' : 'components'
            for (let step = 0; step < 3 && !cancelled; step++) {
              send({ type: 'component', component: componentGen(reply.component.name, folder, step, []) })
              await tick(450)
            }
            ai.component = reply.component
            send({ type: 'component', component: reply.component })
          }
          if (!cancelled && reply.naming) {
            ai.naming = reply.naming
            send({ type: 'naming', naming: reply.naming })
          }
          if (!cancelled && reply.diff) {
            await tick(200)
            ai.diff = reply.diff
            send({ type: 'diff', diff: reply.diff })
          }
          if (!cancelled && reply.plan) {
            await tick(250)
            ai.plan = reply.plan
            send({ type: 'plan', plan: reply.plan })
          }
          if (cancelled) {
            save({ ...ai, stopped: true })
            return
          }
          save(ai)
          send({ type: 'done', message: ai })
          ctrl.close()
        },
        cancel() {
          cancelled = true
        },
      })
      return new HttpResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    })
  }),

  // POST …/ai/plans/{pid}:apply · :discard — records the outcome; the client has already applied the ops.
  http.post(api('/projects/:id/ai/plans/:planAction'), async ({ params, request }) => {
    await latency(120)
    const [id, verb] = action(params.planAction)
    if (verb !== 'apply' && verb !== 'discard') return fail(404, 'not_found', `Unknown action ${verb ?? ''}`)
    const req = verb === 'apply' ? await body<ApplyAiPlanRequest>(request) : { itemIds: [] }
    return withProject(params.id, (_p, pid) => {
      const st = aiState(pid)
      const hit = findTarget(st, id)
      if (!hit) return fail(404, 'not_found', 'Plan not found')
      const { convo, message, kind } = hit
      const current = kind === 'plan' ? message.plan!.status : message.diff!.status
      if (current !== 'pending') return fail(409, 'conflict', `This plan was already ${current}`)

      const res: AiPlanActionResponse = {}
      let updated: AiMessage = message
      if (kind === 'plan') {
        const plan = message.plan!
        const keep = new Set(verb === 'apply' ? (req.itemIds ?? []) : [])
        if (verb === 'apply' && !keep.size)
          return fail(400, 'validation', 'Pick at least one change to apply')
        const next = {
          ...plan,
          status: verb === 'apply' ? ('applied' as const) : ('discarded' as const),
          items: plan.items.map((i) => ({
            ...i,
            status: keep.has(i.id) ? ('applied' as const) : ('skipped' as const),
          })),
        }
        updated = { ...message, plan: next }
        res.plan = next
        if (verb === 'apply') {
          const n = keep.size
          res.message = {
            id: newId('msg'),
            role: 'assistant',
            text: `Applied ${n} of ${plan.items.length} change${plan.items.length === 1 ? '' : 's'}. ${plan.after ?? ''}`.trim(),
            createdAt: new Date().toISOString(),
            links: true,
          }
        }
      } else {
        const next = {
          ...message.diff!,
          status: verb === 'apply' ? ('applied' as const) : ('discarded' as const),
        }
        updated = { ...message, diff: next }
        res.diff = next
      }
      const messages = convo.messages.map((m) => (m.id === message.id ? updated : m))
      if (res.message) messages.push(res.message)
      st.conversations = st.conversations.map((c) =>
        c.id === convo.id ? summarize({ ...c, messages, updatedAt: new Date().toISOString() }) : c,
      )
      persist()
      return json<AiPlanActionResponse>(res)
    })
  }),
]
