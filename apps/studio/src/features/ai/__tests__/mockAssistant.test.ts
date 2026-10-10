/**
 * The scripted assistant must only ever propose ops that apply cleanly to the FieldOps definition,
 * and the SSE endpoint must stream them end to end.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  applyPatch,
  getAt,
  type AiChip,
  type AiConversation,
  type AiMessage,
  type AiPlan,
  type AiStreamEvent,
  type AppDefinition,
  type SendAiMessageRequest,
  type TableField,
} from '@platon/definition'
import { fieldopsDefinition } from '@platon/mocks/seed'
import { createMockServer, resetMockDb } from '@platon/mocks/node'
import {
  accessPlan,
  codeDiff,
  componentReply,
  detectIntent,
  namingReply,
  pagePlan,
  priorityPlan,
  scriptReply,
  seedConversations,
  translatePlan,
} from '../../../../../../mocks/src/seed/ai'
import { useDefinitionStore } from '@/stores/definition'
import { aiApi, streamAiMessage } from '../api'
import { applyAiEvent } from '../sse'
import { planToChanges } from '../plan'

const def = () => fieldopsDefinition()
const applyAll = (d: AppDefinition, p: AiPlan) =>
  applyPatch(
    d,
    planToChanges(p, new Set(p.items.map((i) => i.id))).flatMap((c) => c.ops),
  )
const req = (
  text: string,
  chips: AiChip[] = [],
  context: SendAiMessageRequest['context'] = null,
): SendAiMessageRequest => ({ text, chips, context, model: 'claude' })
const emptyConvo: AiConversation = {
  id: 'c',
  title: '',
  createdAt: '',
  updatedAt: '',
  by: '',
  messageCount: 0,
  appliedCount: 0,
  hasPendingPlan: false,
  snippet: '',
  messages: [],
}

describe('scripted assistant plans apply to the FieldOps definition', () => {
  it('priority: adds the field after status and a column to every work-order table', () => {
    const p = priorityPlan(def()).plan!
    expect(p.items.length).toBeGreaterThanOrEqual(2)
    const next = applyAll(def(), p)
    const fields = getAt<TableField[]>(next, '/data/tables/work_orders/fields')!
    expect(fields.map((f) => f.key).indexOf('priority')).toBe(fields.map((f) => f.key).indexOf('status') + 1)
    expect(getAt<string[]>(next, '/interface/pages/orders/blocks/o3/props/columns')).toEqual([
      'ref',
      'job',
      'customer',
      'tech',
      'status',
      'priority',
      'due',
    ])
    // Asking again proposes nothing.
    expect(priorityPlan(next).plan).toBeUndefined()
  })

  it('every single item applies on its own as well', () => {
    for (const p of [priorityPlan(def()).plan!, accessPlan(def()).plan!, translatePlan(def(), 'uzbek').plan!])
      for (const it of p.items) expect(() => applyPatch(def(), it.change.ops)).not.toThrow()
  })

  it.each(['Translate the app to Uzbek', 'Add Russian', 'Translate to Spanish'])('translate: %s', (text) => {
    const p = translatePlan(def(), text).plan!
    expect(() => applyAll(def(), p)).not.toThrow()
  })

  it.each(['Create a page for equipment', 'Add a Schedule page', 'make a new screen'])(
    'page: %s gets a unique id and lands after Work orders',
    (text) => {
      const p = pagePlan(def(), text).plan!
      const next = applyAll(def(), p)
      const ids = next.interface.pages.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
      const added = ids.find((x) => !def().interface.pages.some((p0) => p0.id === x))
      expect(ids[ids.indexOf('orders') + 1]).toBe(added)
      expect(ids.length).toBe(def().interface.pages.length + 1)
    },
  )

  it('access plan applies', () => {
    const next = applyAll(def(), accessPlan(def()).plan!)
    expect(getAt(next, '/interface/pages/techs/visibleTo')).toEqual(['admin', 'dispatcher'])
  })

  it('code diff replaces the page script and keeps the rest', () => {
    const r = codeDiff(def(), {
      context: { kind: 'code', path: '/interface/pages/orders/script', label: 'orders.page.js' },
      chips: [],
    })
    const next = applyPatch(def(), r.diff!.change.ops)
    expect(getAt<string>(next, '/interface/pages/orders/script/source')).toContain('ctx.every(30_000')
  })

  it('component flow: naming → generated component registered by plan', () => {
    const n = namingReply(def(), 'A 1–5 star rating customers can click', 'component', false).naming!
    expect(n.options[0]).toBe('RatingStars')
    const r = componentReply(def(), n, 'RatingStars', 'star rating')
    const next = applyAll(def(), r.plan!)
    expect(getAt(next, '/components/component:rating_stars/name')).toBe('RatingStars')
  })

  it('pending plans in the seeded history still apply', () => {
    for (const c of seedConversations())
      for (const m of c.messages)
        if (m.plan?.status === 'pending') expect(() => applyAll(def(), m.plan!)).not.toThrow()
  })

  it('routes intents from text, skills and context', () => {
    expect(detectIntent(req('add a priority to jobs'))).toBe('priority')
    expect(
      detectIntent(
        req('', [
          {
            kind: 'skill',
            key: 'skill:translate',
            label: 'Translate app',
            icon: 'languages',
            skill: 'translate',
          },
        ]),
      ),
    ).toBe('translate')
    expect(detectIntent(req('make it faster', [], { kind: 'code', label: 'orders.page.js' }))).toBe('code')
    expect(detectIntent(req('hello'))).toBe('chat')
    expect(scriptReply(def(), req('hello'), emptyConvo).text).toContain('plan')
  })
})

describe('SSE endpoint', () => {
  const server = createMockServer()
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())
  beforeEach(() => {
    resetMockDb()
    setActivePinia(createPinia())
  })

  it('streams tokens and a plan; applying records the status and changes the definition', async () => {
    const store = useDefinitionStore()
    await store.load('fieldops')
    const convo = await aiApi.create('fieldops')
    const events: AiStreamEvent[] = []
    let msg: AiMessage = { id: 'tmp', role: 'assistant', text: '', createdAt: '' }
    await streamAiMessage(
      'fieldops',
      convo.id,
      req('Add a priority to work orders'),
      (e) => {
        events.push(e)
        msg = applyAiEvent(msg, e)
      },
      new AbortController().signal,
    )

    const types = events.map((e) => e.type)
    expect(types[0]).toBe('start')
    expect(types.filter((x) => x === 'token').length).toBeGreaterThan(3)
    expect(types).toContain('plan')
    expect(types.at(-1)).toBe('done')
    expect(msg.plan?.status).toBe('pending')

    const plan = msg.plan!
    expect(store.apply(planToChanges(plan, new Set(plan.items.map((i) => i.id))), { authorKind: 'ai' })).toBe(
      true,
    )
    const res = await aiApi.apply(
      'fieldops',
      plan.id,
      plan.items.map((i) => i.id),
    )
    expect(res.plan?.status).toBe('applied')
    expect(res.message?.text).toMatch(/^Applied \d+ of \d+ changes/)
    expect(
      store.get<TableField[]>('/data/tables/work_orders/fields')!.some((f) => f.key === 'priority'),
    ).toBe(true)

    const saved = await aiApi.get('fieldops', convo.id)
    expect(saved.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant'])
    await expect(aiApi.discard('fieldops', plan.id)).rejects.toMatchObject({ status: 409 })
  })
})
