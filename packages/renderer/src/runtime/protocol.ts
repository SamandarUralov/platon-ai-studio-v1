/** Messages between the page-script Worker and its host (Preview / runtime). Plain, cloneable data only. */
import type { LifecycleHandler } from '@platon/definition'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface BlockSnapshot {
  type: string
  props: Record<string, unknown>
}

export type HostToWorker =
  | {
      t: 'init'
      source: string
      lifecycle: Record<string, LifecycleHandler[]>
      blocks: Record<string, BlockSnapshot>
      route: { path: string; params: Record<string, string>; query: Record<string, string> }
      user: { name: string; role: string }
      today: string
    }
  | { t: 'event'; key: string; arg: unknown }
  | { t: 'reply'; id: number; ok: boolean; value?: unknown; error?: string }
  | { t: 'block'; ref: string; props: Record<string, unknown> }
  | { t: 'leave' }

export type RequestOp = 'call' | 'load' | 'reload' | 'refresh' | 'submit' | 'reset' | 'setValue' | 'confirm'

export type WorkerToHost =
  | { t: 'set'; ref: string; prop: string; value: unknown }
  | { t: 'state'; state: Record<string, unknown> }
  | { t: 'request'; id: number; op: RequestOp; ref?: string; args: unknown[] }
  | { t: 'toast'; text: string; tone?: string }
  | { t: 'navigate'; to: string }
  | { t: 'log'; level: LogLevel; text: string; src?: string }
  | { t: 'busy' }
  | { t: 'idle' }
  | { t: 'ready'; handlers: string[] }

/** Block methods page code may call (anything else is a property). */
export const BLOCK_METHODS = ['load', 'reload', 'refresh', 'submit', 'reset', 'setValue', 'field'] as const

/**
 * Patterns refused before a script reaches the Worker: anything that could reach the network or
 * load more code. The Worker also removes these globals; this check gives a clear error instead.
 */
export const FORBIDDEN: [RegExp, string][] = [
  [/\bimport\s*\(|^\s*import\s/m, 'Page code can’t import other code'],
  [
    /\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\b/,
    'Page code can’t reach the network. Use ctx.call()',
  ],
  [
    /\b(document|window|localStorage|sessionStorage|indexedDB)\b/,
    'Page code can’t touch the browser page. Use ctx.blocks',
  ],
]

export function forbidden(source: string): string | null {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  for (const [re, msg] of FORBIDDEN) if (re.test(noComments)) return msg
  return null
}

/** Wrap an inline lifecycle handler as a module so it runs the same way as the page file. */
export function handlerModule(h: LifecycleHandler): string {
  if (h.kind === 'function') {
    const args = Object.entries(h.args ?? {})
      .map(([k, v]) => `${JSON.stringify(k)}: (${v.trim() || 'undefined'})`)
      .join(', ')
    return `export default async (ctx) => ctx.call(${JSON.stringify(h.fn ?? '')}, { ${args} })\n`
  }
  return `export default async (ctx) => {\n${h.code ?? ''}\n}\n`
}

export function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
