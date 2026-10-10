import { describe, expect, it } from 'vitest'
import type { AiMessage, AiPlan } from '@platon/definition'
import { applyAiEvent, parseAiEvent } from '../sse'

const plan: AiPlan = { id: 'plan_1', title: 'P', status: 'pending', items: [] }

describe('parseAiEvent', () => {
  it('parses known events and stamps the type from the SSE event name', () => {
    expect(parseAiEvent('token', '{"text":"Hel"}')).toEqual({ type: 'token', text: 'Hel' })
    expect(parseAiEvent('plan', JSON.stringify({ plan }))).toEqual({ type: 'plan', plan })
    expect(parseAiEvent('error', '{"message":"Quota exceeded"}')).toEqual({
      type: 'error',
      message: 'Quota exceeded',
    })
  })

  it('ignores unknown events, malformed JSON and wrong payload shapes', () => {
    expect(parseAiEvent('ping', '{}')).toBeNull()
    expect(parseAiEvent(undefined, '{"text":"x"}')).toBeNull()
    expect(parseAiEvent('token', '{oops')).toBeNull()
    expect(parseAiEvent('token', '{"text":42}')).toBeNull()
    expect(parseAiEvent('plan', '{"plan":{"id":"x"}}')).toBeNull()
    expect(parseAiEvent('token', '"just a string"')).toBeNull()
  })
})

describe('applyAiEvent', () => {
  it('folds a stream into one assistant message', () => {
    let m: AiMessage = { id: 'tmp', role: 'assistant', text: '', createdAt: '2026-01-01T00:00:00Z' }
    const frames: [string, string][] = [
      [
        'start',
        JSON.stringify({
          messageId: 'msg_1',
          title: 'T',
          userMessage: { id: 'u', role: 'user', text: 'hi', createdAt: '' },
        }),
      ],
      ['note', '{"text":"Following Agent.md."}'],
      ['token', '{"text":"Here is "}'],
      ['token', '{"text":"a plan."}'],
      ['plan', JSON.stringify({ plan })],
    ]
    for (const [ev, data] of frames) {
      const e = parseAiEvent(ev, data)
      if (e) m = applyAiEvent(m, e)
    }
    expect(m).toMatchObject({ id: 'msg_1', text: 'Here is a plan.', note: 'Following Agent.md.', plan })
  })

  it('takes the server copy on done but keeps streamed text if the server sent none', () => {
    const m: AiMessage = { id: 'msg_1', role: 'assistant', text: 'partial', createdAt: '' }
    const done = applyAiEvent(m, {
      type: 'done',
      message: { id: 'msg_1', role: 'assistant', text: '', createdAt: 'x', links: true },
    })
    expect(done).toMatchObject({ text: 'partial', links: true, createdAt: 'x' })
  })
})
