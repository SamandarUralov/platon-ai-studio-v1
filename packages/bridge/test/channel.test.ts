import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHostChannel, PROTOCOL_VERSION, BridgeError } from '../src'

const ORIGIN = 'https://constructor.test'

function fakePeer() {
  const posted: { data: unknown; origin: string }[] = []
  return {
    posted,
    win: {
      postMessage: (data: unknown, origin: string) => posted.push({ data, origin }),
    } as unknown as Window,
  }
}

function deliver(data: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}

describe('bridge channel', () => {
  let close: () => void = () => {}
  afterEach(() => close())

  it('posts envelopes with an explicit target origin', () => {
    const peer = fakePeer()
    const ch = createHostChannel({ target: peer.win, origin: ORIGIN })
    close = ch.close
    ch.send('host:theme', { theme: 'dark' })
    expect(peer.posted[0]!.origin).toBe(ORIGIN)
    expect(peer.posted[0]!.data).toMatchObject({
      source: 'platon-studio',
      v: PROTOCOL_VERSION,
      type: 'host:theme',
      payload: { theme: 'dark' },
    })
  })

  it('accepts guest messages only from the allowed origin', () => {
    const ch = createHostChannel({ target: fakePeer().win, origin: ORIGIN })
    close = ch.close
    const seen = vi.fn()
    ch.on('guest:dirty', seen)
    const env = {
      source: 'platon-constructor',
      v: PROTOCOL_VERSION,
      id: '1',
      type: 'guest:dirty',
      payload: { dirty: true },
    }
    deliver(env, 'https://evil.test')
    expect(seen).not.toHaveBeenCalled()
    deliver(env)
    expect(seen).toHaveBeenCalledWith({ dirty: true }, expect.anything())
  })

  it('reports protocol version mismatches instead of dispatching', () => {
    const ch = createHostChannel({ target: fakePeer().win, origin: ORIGIN })
    close = ch.close
    const seen = vi.fn()
    const mismatch = vi.fn()
    ch.on('guest:ready', seen)
    ch.on('$version-mismatch', mismatch)
    deliver({ source: 'platon-constructor', v: 99, id: '1', type: 'guest:ready', payload: {} })
    expect(seen).not.toHaveBeenCalled()
    expect(mismatch).toHaveBeenCalledWith({ got: 99, want: PROTOCOL_VERSION }, expect.anything())
  })

  it('resolves requests by reply id and times out otherwise', async () => {
    vi.useFakeTimers()
    const peer = fakePeer()
    const ch = createHostChannel({ target: peer.win, origin: ORIGIN, timeoutMs: 100 })
    close = ch.close
    const p = ch.request('host:command', { name: 'save' })
    const sent = peer.posted[0]!.data as { id: string }
    deliver({
      source: 'platon-constructor',
      v: PROTOCOL_VERSION,
      id: 'r',
      re: sent.id,
      type: 'guest:reply',
      payload: { ok: true, result: 'saved' },
    })
    await expect(p).resolves.toBe('saved')

    const late = ch.request('host:command', { name: 'format' })
    vi.advanceTimersByTime(150)
    await expect(late).rejects.toBeInstanceOf(BridgeError)
    vi.useRealTimers()
  })
})
