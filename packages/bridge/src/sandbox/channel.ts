/**
 * Studio side of the Sandbox channel. Posts only to the Sandbox origin and accepts messages only
 * from that origin *and* from the iframe's own window, so another frame on the same origin can't
 * drive the editor.
 */
import {
  unwrapSandbox,
  wrapSandbox,
  type SandboxToStudio,
  type SandboxToStudioMessage,
  type StudioToSandbox,
} from './protocol'

export interface SandboxChannelOptions {
  /** The iframe's window; a getter because the frame may (re)mount. */
  target: () => Window | null | undefined
  /** Exact Sandbox origin, e.g. https://sandbox.platon.app */
  origin: string
  listenOn?: Window
}

type Handler<K extends keyof SandboxToStudio> = (msg: SandboxToStudio[K]) => void

export function createSandboxChannel(opts: SandboxChannelOptions) {
  const listenOn = opts.listenOn ?? window
  const handlers = new Map<string, Set<(msg: never) => void>>()

  function emit(type: string, msg: unknown) {
    for (const h of handlers.get(type) ?? []) {
      try {
        ;(h as (m: unknown) => void)(msg)
      } catch {
        // A faulty listener must not break the channel.
      }
    }
  }

  function onMessage(e: MessageEvent) {
    if (e.origin !== opts.origin) return
    const target = opts.target()
    if (!target || e.source !== target) return
    const msg = unwrapSandbox(e.data)
    if (msg === 'version') return emit('$version-mismatch', { got: (e.data as { version: unknown }).version })
    if (msg) emit(msg.type, msg)
  }
  listenOn.addEventListener('message', onMessage)

  return {
    /** Returns false when the frame isn't there yet (the caller re-sends on `ready`). */
    send<K extends keyof StudioToSandbox>(type: K, payload: StudioToSandbox[K]): boolean {
      const w = opts.target()
      if (!w) return false
      w.postMessage(wrapSandbox({ type, ...payload }), opts.origin)
      return true
    },
    on<K extends keyof SandboxToStudio | '$version-mismatch'>(
      type: K,
      handler: K extends keyof SandboxToStudio ? Handler<K> : (e: { got: unknown }) => void,
    ): () => void {
      const set = handlers.get(type) ?? new Set()
      set.add(handler as (msg: never) => void)
      handlers.set(type, set)
      return () => set.delete(handler as (msg: never) => void)
    },
    close() {
      listenOn.removeEventListener('message', onMessage)
      handlers.clear()
    },
  }
}

export type SandboxChannel = ReturnType<typeof createSandboxChannel>
export type { SandboxToStudioMessage }
