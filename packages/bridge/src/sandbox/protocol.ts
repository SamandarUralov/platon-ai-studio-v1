/**
 * Studio ↔ Sandbox postMessage protocol — mirror of platon-sandbox `src/protocol/messages.ts`.
 * The Sandbox defines the envelope (`channel` + `version`); both sides refuse other versions.
 */
import type { SandboxDataMode, SandboxMode, SandboxProjectMeta } from './meta'

export const SANDBOX_PROTOCOL_VERSION = 1 as const
export const SANDBOX_CHANNEL = 'platon-sandbox' as const

export type Rect = { x: number; y: number; width: number; height: number }

/** Messages the Studio sends, by type. */
export interface StudioToSandbox {
  init: {
    meta: SandboxProjectMeta
    mode: SandboxMode
    pageId?: string
    role?: string | null
    data?: SandboxDataMode
    fit?: boolean
  }
  'set-mode': { mode: SandboxMode }
  'set-role': { role: string | null }
  'select-block': { blockId: string | null }
  navigate: { pageId: string }
  'drag-over': { point: { x: number; y: number }; draggable?: { component?: string; blockId?: string } }
  'drag-end': Record<string, never>
}

/** Messages the Sandbox sends, by type. */
export interface SandboxToStudio {
  ready: { protocolVersion: number }
  'block-selected': { blockId: string | null }
  'block-hover': { blockId: string | null }
  /** Viewport rect of the selected block, re-sent when the layout moves it. */
  'block-rect': { blockId: string | null; rect: Rect | null }
  'drop-target': { parentId: string | null; index: number; rect?: Rect; parentRect?: Rect }
  'drop-clear': Record<string, never>
  drop: { parentId: string | null; index: number; source?: { blockId?: string } }
  'content-size': { height: number }
  'page-changed': { pageId: string }
  'role-changed': { role: string | null }
  error: { message: string; stack?: string; source?: { blockId?: string; pageId?: string } }
  console: { level: 'log' | 'info' | 'warn' | 'error' | 'debug'; args: unknown[] }
}

type Union<M> = { [K in keyof M]: { type: K } & M[K] }[keyof M]
export type StudioToSandboxMessage = Union<StudioToSandbox>
export type SandboxToStudioMessage = Union<SandboxToStudio>

export interface SandboxEnvelope<T> {
  channel: typeof SANDBOX_CHANNEL
  version: number
  payload: T
}

export const wrapSandbox = <T>(payload: T): SandboxEnvelope<T> => ({
  channel: SANDBOX_CHANNEL,
  version: SANDBOX_PROTOCOL_VERSION,
  payload,
})

/** The payload of a Sandbox envelope, `'version'` when it speaks another version, else null. */
export function unwrapSandbox(data: unknown): SandboxToStudioMessage | 'version' | null {
  if (!data || typeof data !== 'object') return null
  const env = data as Partial<SandboxEnvelope<unknown>>
  if (env.channel !== SANDBOX_CHANNEL) return null
  if (env.version !== SANDBOX_PROTOCOL_VERSION) return 'version'
  const p = env.payload as { type?: unknown } | undefined
  return p && typeof p.type === 'string' ? (p as SandboxToStudioMessage) : null
}
