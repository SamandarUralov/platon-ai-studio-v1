/**
 * Studio AI stream protocol: parse SSE frames into typed events and fold them into the assistant
 * message being built. Pure, so it is unit-tested without a network.
 */
import type { AiMessage, AiStreamEvent, AiStreamEventType } from '@platon/definition'

const TYPES: ReadonlySet<AiStreamEventType> = new Set([
  'start',
  'token',
  'note',
  'plan',
  'diff',
  'naming',
  'component',
  'links',
  'done',
  'error',
])

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * One SSE frame → event. Unknown event names and malformed JSON are ignored (null) so a newer
 * server can add events without breaking older clients.
 */
export function parseAiEvent(event: string | undefined, data: string): AiStreamEvent | null {
  const type = (event || 'message') as AiStreamEventType
  if (!TYPES.has(type)) return null
  let payload: unknown
  try {
    payload = data ? JSON.parse(data) : {}
  } catch {
    return null
  }
  if (!isObject(payload)) return null
  const e = { ...payload, type } as AiStreamEvent
  switch (e.type) {
    case 'token':
    case 'note':
      return typeof e.text === 'string' ? e : null
    case 'plan':
      return isObject(e.plan) && Array.isArray(e.plan.items) ? e : null
    case 'diff':
      return isObject(e.diff) && Array.isArray(e.diff.lines) ? e : null
    case 'naming':
      return isObject(e.naming) ? e : null
    case 'component':
      return isObject(e.component) ? e : null
    case 'done':
      return isObject(e.message) ? e : null
    case 'error':
      return typeof e.message === 'string' ? e : null
    case 'start':
      return typeof e.messageId === 'string' && isObject(e.userMessage) ? e : null
    case 'links':
      return e
  }
}

/** Fold one event into the assistant message under construction. */
export function applyAiEvent(msg: AiMessage, e: AiStreamEvent): AiMessage {
  switch (e.type) {
    case 'start':
      return { ...msg, id: e.messageId }
    case 'token':
      return { ...msg, text: msg.text + e.text }
    case 'note':
      return { ...msg, note: e.text }
    case 'plan':
      return { ...msg, plan: e.plan }
    case 'diff':
      return { ...msg, diff: e.diff }
    case 'naming':
      return { ...msg, naming: e.naming }
    case 'component':
      return { ...msg, component: e.component }
    case 'links':
      return { ...msg, links: true }
    case 'done':
      // The server copy is canonical, but keep text we already streamed if it sent less.
      return { ...e.message, text: e.message.text || msg.text }
    case 'error':
      return msg
  }
}
