/**
 * A typed, origin-checked postMessage channel. One instance per side:
 *   host:  createChannel({ self: 'platon-studio', peer: 'platon-constructor', target: iframe.contentWindow, origin })
 *   guest: createChannel({ self: 'platon-constructor', peer: 'platon-studio', target: window.parent, origin })
 * Never posts with '*' and drops messages from any origin other than `origin`.
 */
import { PROTOCOL_VERSION, isEnvelope, type Envelope, type Source } from './protocol'

export interface ChannelOptions {
  self: Source
  peer: Source
  /** Window to post to. A getter allows the iframe to be (re)mounted. */
  target: Window | null | (() => Window | null)
  /** Exact origin of the peer, e.g. https://constructor.platon.app */
  origin: string
  /** Window that receives messages (defaults to globalThis.window). */
  listenOn?: Window
  timeoutMs?: number
}

type Handler = (payload: unknown, env: Envelope) => unknown

export class BridgeError extends Error {
  constructor(
    readonly code: 'timeout' | 'version' | 'closed' | 'remote',
    message: string,
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}

let seq = 0
const nextId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`

export function createChannel<Out extends object, In extends object>(opts: ChannelOptions) {
  const listenOn = opts.listenOn ?? window
  const timeoutMs = opts.timeoutMs ?? 8000
  const handlers = new Map<string, Set<Handler>>()
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  let closed = false

  const targetWindow = () => (typeof opts.target === 'function' ? opts.target() : opts.target)

  function post(env: Envelope) {
    if (closed) throw new BridgeError('closed', 'Channel is closed')
    const w = targetWindow()
    if (!w) throw new BridgeError('closed', 'Peer window is not available')
    w.postMessage(env, opts.origin)
  }

  function onMessage(e: MessageEvent) {
    if (e.origin !== opts.origin) return
    if (!isEnvelope(e.data, opts.peer)) return
    const env = e.data
    if (env.v !== PROTOCOL_VERSION) {
      emitLocal('$version-mismatch', { got: env.v, want: PROTOCOL_VERSION }, env)
      return
    }
    if (env.re && pending.has(env.re)) {
      const p = pending.get(env.re)!
      pending.delete(env.re)
      clearTimeout(p.timer)
      const reply = env.payload as { ok?: boolean; result?: unknown; error?: string }
      if (reply && reply.ok === false) p.reject(new BridgeError('remote', reply.error ?? 'Remote error'))
      else p.resolve(reply?.result)
      return
    }
    emitLocal(env.type, env.payload, env)
  }

  function emitLocal(type: string, payload: unknown, env: Envelope) {
    for (const h of handlers.get(type) ?? []) {
      try {
        const out = h(payload, env)
        if (out instanceof Promise) out.catch(() => {})
      } catch {
        // A faulty listener must not break the channel.
      }
    }
  }

  listenOn.addEventListener('message', onMessage)

  return {
    send<K extends keyof Out & string>(type: K, payload: Out[K]): string {
      const id = nextId()
      post({ source: opts.self, v: PROTOCOL_VERSION, id, type, payload })
      return id
    },
    /** Send and wait for a `*:reply` correlated by id. */
    request<K extends keyof Out & string>(type: K, payload: Out[K]): Promise<unknown> {
      const id = nextId()
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new BridgeError('timeout', `No reply to ${type} within ${timeoutMs}ms`))
        }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        try {
          post({ source: opts.self, v: PROTOCOL_VERSION, id, type, payload })
        } catch (err) {
          clearTimeout(timer)
          pending.delete(id)
          reject(err as Error)
        }
      })
    },
    reply(to: Envelope, type: string, payload: { ok: boolean; result?: unknown; error?: string }) {
      post({ source: opts.self, v: PROTOCOL_VERSION, id: nextId(), re: to.id, type, payload })
    },
    on<K extends (keyof In & string) | '$version-mismatch'>(
      type: K,
      handler: (
        payload: K extends keyof In ? In[K] : { got: number; want: number },
        env: Envelope,
      ) => unknown,
    ): () => void {
      const set = handlers.get(type) ?? new Set()
      set.add(handler as Handler)
      handlers.set(type, set)
      return () => set.delete(handler as Handler)
    },
    close() {
      closed = true
      listenOn.removeEventListener('message', onMessage)
      for (const p of pending.values()) {
        clearTimeout(p.timer)
        p.reject(new BridgeError('closed', 'Channel closed'))
      }
      pending.clear()
      handlers.clear()
    },
  }
}

export type Channel<Out extends object, In extends object> = ReturnType<typeof createChannel<Out, In>>
