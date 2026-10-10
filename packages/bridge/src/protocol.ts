/**
 * Studio ↔ Constructor iframe protocol (docs/IMPLEMENTATION_PLAN.md, F14).
 * Bump PROTOCOL_VERSION on any breaking change; both sides refuse other versions.
 */
export const PROTOCOL_VERSION = 1 as const

export type Theme = 'light' | 'dark'

export interface ComponentPropMeta {
  name: string
  label: string
  type: 'String' | 'Number' | 'Boolean' | 'Array' | 'Object'
  input:
    | 'text'
    | 'textarea'
    | 'select'
    | 'color'
    | 'number'
    | 'slider'
    | 'toggle'
    | 'source'
    | 'list'
    | 'json'
    | 'record'
  required: boolean
  default?: unknown
  options?: string[]
  /** Studio AI may fill this value. */
  ai?: boolean
}

export interface ComponentMeta {
  id: string
  kind: 'vue-component'
  name: string
  file: string
  source: { type: 'ai' | 'code'; prompt?: string }
  props: ComponentPropMeta[]
  events: string[]
}

export type ConstructorStatus = 'building' | 'needs_review' | 'reviewed' | 'live' | 'out_of_sync'

/** Messages the Studio (host) sends. */
export interface HostMessages {
  'host:init': {
    projectId: string
    componentId: string
    token: string
    locale: string
    theme: Theme
    studioRole: string
  }
  'host:theme': { theme: Theme }
  'host:props': { values: Record<string, unknown> }
  'host:viewport': { width: number }
  'host:command': { name: 'save' | 'discard' | 'format' }
}

/** Messages the Constructor (guest) sends. */
export interface GuestMessages {
  'guest:ready': { version: string; capabilities: string[] }
  'guest:meta': { meta: ComponentMeta }
  'guest:status': { status: ConstructorStatus }
  'guest:dirty': { dirty: boolean }
  'guest:resize': { height: number }
  'guest:error': { code: string; message: string }
  'guest:navigate': { to: string }
  /** Reply to a request; `ok: false` carries an error. */
  'guest:reply': { ok: boolean; result?: unknown; error?: string }
}

export type Source = 'platon-studio' | 'platon-constructor'

export interface Envelope<T extends string = string, P = unknown> {
  source: Source
  v: typeof PROTOCOL_VERSION
  id: string
  /** Set on replies: the id of the message being answered. */
  re?: string
  type: T
  payload: P
}

export function isEnvelope(data: unknown, from: Source): data is Envelope {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<Envelope>
  return d.source === from && typeof d.type === 'string' && typeof d.id === 'string' && 'payload' in d
}
