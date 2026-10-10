import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { PROTOCOL_VERSION } from '@platon/bridge'

vi.mock('../api', () => ({
  createComponentSession: vi.fn(async () => ({ token: 'tok_1', expiresAt: '2030-01-01T00:00:00Z' })),
}))

const ORIGIN = 'http://localhost:5174'
const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })

async function load() {
  vi.resetModules()
  return (await import('../ConstructorFrame.vue')).default
}

function mountFrame(Frame: Awaited<ReturnType<typeof load>>, extra: Record<string, unknown> = {}) {
  return mount(Frame, {
    props: {
      projectId: 'fieldops',
      componentId: 'job_timeline',
      componentName: 'JobTimeline',
      theme: 'light',
      locale: 'en',
      studioRole: 'owner',
      values: { title: 'x' },
      handshakeMs: 200,
      ...extra,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

describe('ConstructorFrame', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONSTRUCTOR_ORIGIN', ORIGIN)
    // Don't let happy-dom actually load the (non-existent) constructor page.
    const hd = (window as unknown as { happyDOM?: { settings: { disableIframePageLoading: boolean } } })
      .happyDOM
    if (hd) hd.settings.disableIframePageLoading = true
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('falls back when the constructor origin is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const w = mountFrame(await load())
    await flushPromises()
    expect(w.emitted('unavailable')?.[0]).toEqual(['unreachable'])
    expect(w.find('iframe').exists()).toBe(false)
  })

  it('times out when the guest never says ready, and never puts the token in the URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null)),
    )
    const w = mountFrame(await load())
    await flushPromises()
    const src = w.find('iframe').attributes('src')!
    expect(src.startsWith(`${ORIGIN}/embed?`)).toBe(true)
    expect(src).not.toContain('tok')
    expect(w.find('iframe').attributes('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups',
    )
    await new Promise((r) => setTimeout(r, 260))
    expect(w.emitted('unavailable')?.[0]).toEqual(['timeout'])
  })

  it('answers guest:ready with host:init to the exact origin and ignores other origins', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null)),
    )
    const w = mountFrame(await load(), { handshakeMs: 5000 })
    await flushPromises()
    const post = vi.fn()
    Object.defineProperty(w.find('iframe').element, 'contentWindow', { value: { postMessage: post } })
    const ready = {
      source: 'platon-constructor',
      v: PROTOCOL_VERSION,
      id: 'g1',
      type: 'guest:ready',
      payload: { version: '1.0.0', capabilities: [] },
    }

    window.dispatchEvent(new MessageEvent('message', { data: ready, origin: 'http://evil.test' }))
    await flushPromises()
    expect(post).not.toHaveBeenCalled()

    window.dispatchEvent(new MessageEvent('message', { data: ready, origin: ORIGIN }))
    await flushPromises()
    const [env, target] = post.mock.calls[0]! as [{ type: string; payload: Record<string, unknown> }, string]
    expect(target).toBe(ORIGIN)
    expect(env.type).toBe('host:init')
    expect(env.payload).toMatchObject({
      projectId: 'fieldops',
      componentId: 'component:job_timeline',
      token: 'tok_1',
      theme: 'light',
    })
    expect(post.mock.calls[1]![0]).toMatchObject({ type: 'host:props', payload: { values: { title: 'x' } } })
    expect(w.emitted('ready')).toBeTruthy()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...ready, id: 'g2', type: 'guest:dirty', payload: { dirty: true } },
        origin: ORIGIN,
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...ready, id: 'g3', v: 2, type: 'guest:status', payload: { status: 'live' } },
        origin: ORIGIN,
      }),
    )
    await flushPromises()
    expect(w.emitted('dirty')?.[0]).toEqual([true])
    expect(w.emitted('version-mismatch')?.[0]).toEqual([2, PROTOCOL_VERSION])
    expect(w.emitted('status')).toBeFalsy()
    w.unmount()
  })
})
