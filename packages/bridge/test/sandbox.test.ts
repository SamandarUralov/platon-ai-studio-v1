import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSandboxChannel, SANDBOX_CHANNEL, SANDBOX_PROTOCOL_VERSION, wrapSandbox } from '../src/sandbox'

const ORIGIN = 'https://sandbox.test'

function frame() {
  const posted: { data: unknown; origin: string }[] = []
  const win = {
    postMessage: (data: unknown, origin: string) => posted.push({ data, origin }),
  } as unknown as Window
  return { win, posted }
}

function deliver(data: unknown, source: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }))
}

describe('sandbox channel', () => {
  let close: () => void = () => {}
  afterEach(() => close())

  it('posts wrapped messages to the exact sandbox origin', () => {
    const f = frame()
    const ch = createSandboxChannel({ target: () => f.win, origin: ORIGIN })
    close = ch.close
    expect(ch.send('select-block', { blockId: 'b1' })).toBe(true)
    expect(f.posted[0]).toEqual({
      origin: ORIGIN,
      data: {
        channel: SANDBOX_CHANNEL,
        version: SANDBOX_PROTOCOL_VERSION,
        payload: { type: 'select-block', blockId: 'b1' },
      },
    })
  })

  it('reports a missing frame instead of throwing', () => {
    const ch = createSandboxChannel({ target: () => null, origin: ORIGIN })
    close = ch.close
    expect(ch.send('navigate', { pageId: 'p' })).toBe(false)
  })

  it('accepts messages only from the sandbox origin and its own frame', () => {
    const f = frame()
    const ch = createSandboxChannel({ target: () => f.win, origin: ORIGIN })
    close = ch.close
    const onSelect = vi.fn()
    ch.on('block-selected', onSelect)
    const msg = wrapSandbox({ type: 'block-selected', blockId: 'b1' })

    deliver(msg, f.win, 'https://evil.test')
    deliver(msg, frame().win)
    deliver(msg, f.win)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith({ type: 'block-selected', blockId: 'b1' })
  })

  it('flags a protocol version mismatch and drops the message', () => {
    const f = frame()
    const ch = createSandboxChannel({ target: () => f.win, origin: ORIGIN })
    close = ch.close
    const onReady = vi.fn()
    const onMismatch = vi.fn()
    ch.on('ready', onReady)
    ch.on('$version-mismatch', onMismatch)

    deliver({ channel: SANDBOX_CHANNEL, version: 99, payload: { type: 'ready', protocolVersion: 99 } }, f.win)

    expect(onReady).not.toHaveBeenCalled()
    expect(onMismatch).toHaveBeenCalledWith({ got: 99 })
  })

  it('ignores foreign postMessage traffic', () => {
    const f = frame()
    const ch = createSandboxChannel({ target: () => f.win, origin: ORIGIN })
    close = ch.close
    const onReady = vi.fn()
    ch.on('ready', onReady)
    deliver({ type: 'ready' }, f.win)
    deliver({ channel: 'other', version: 1, payload: { type: 'ready' } }, f.win)
    expect(onReady).not.toHaveBeenCalled()
  })
})
