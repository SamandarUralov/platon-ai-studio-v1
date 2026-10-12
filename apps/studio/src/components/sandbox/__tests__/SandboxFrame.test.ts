import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { SANDBOX_CHANNEL, SANDBOX_PROTOCOL_VERSION, type SandboxProjectMeta } from '@platon/bridge/sandbox'

const URL_ = 'http://localhost:5175'
const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })

const meta: SandboxProjectMeta = {
  schemaVersion: 1,
  id: 'fieldops',
  name: 'FieldOps',
  theme: { tokens: {} },
  roles: ['admin'],
  data_models: [],
  custom_components: [],
  global_state: {},
  global_hooks: [],
  menu: [],
  pages: [{ id: 'home', label: 'Home', path: '/', blocks: [] }],
}

async function setup(extra: Record<string, unknown> = {}) {
  vi.resetModules()
  const Frame = (await import('../SandboxFrame.vue')).default
  const w = mount(Frame, {
    props: { meta, mode: 'interface', pageId: 'home', handshakeMs: 5000, ...extra },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await flushPromises()
  const post = vi.fn()
  const win = { postMessage: post }
  Object.defineProperty(w.find('iframe').element, 'contentWindow', { value: win })
  const send = (payload: Record<string, unknown>, origin = URL_, source: unknown = win, version = 1) =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { channel: SANDBOX_CHANNEL, version, payload },
        origin,
        source: source as Window,
      }),
    )
  return { w, post, send }
}

describe('SandboxFrame', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SANDBOX_URL', URL_)
    const hd = (window as unknown as { happyDOM?: { settings: { disableIframePageLoading: boolean } } })
      .happyDOM
    if (hd) hd.settings.disableIframePageLoading = true
  })
  afterEach(() => vi.unstubAllEnvs())

  it('names the Studio origin in the URL and sandboxes the frame', async () => {
    const { w } = await setup()
    const src = new URL(w.find('iframe').attributes('src')!)
    expect(src.origin).toBe(URL_)
    expect(src.searchParams.get('studioOrigin')).toBe(window.location.origin)
    expect(w.find('iframe').attributes('sandbox')).toContain('allow-scripts')
    w.unmount()
  })

  it('answers ready with init to the exact origin, ignoring other origins and frames', async () => {
    const { w, post, send } = await setup({ role: 'admin', selected: 'b1' })
    send({ type: 'ready', protocolVersion: 1 }, 'http://evil.test')
    send({ type: 'ready', protocolVersion: 1 }, URL_, { postMessage: vi.fn() })
    await flushPromises()
    expect(post).not.toHaveBeenCalled()

    send({ type: 'ready', protocolVersion: 1 })
    await flushPromises()
    const [env, target] = post.mock.calls[0]! as [{ payload: Record<string, unknown> }, string]
    expect(target).toBe(URL_)
    expect(env).toMatchObject({
      channel: SANDBOX_CHANNEL,
      version: SANDBOX_PROTOCOL_VERSION,
      payload: { type: 'init', mode: 'interface', pageId: 'home', role: 'admin', meta: { id: 'fieldops' } },
    })
    expect(post.mock.calls[1]![0]).toMatchObject({ payload: { type: 'select-block', blockId: 'b1' } })
    w.unmount()
  })

  it('re-inits on meta changes and sends navigation separately', async () => {
    const { w, post, send } = await setup()
    send({ type: 'ready', protocolVersion: 1 })
    await flushPromises()
    post.mockClear()

    await w.setProps({ meta: { ...meta, name: 'Renamed' } })
    await flushPromises()
    expect(post.mock.calls[0]![0]).toMatchObject({ payload: { type: 'init', meta: { name: 'Renamed' } } })

    post.mockClear()
    await w.setProps({ pageId: 'other' })
    expect(post.mock.calls[0]![0]).toMatchObject({ payload: { type: 'navigate', pageId: 'other' } })
    w.unmount()
  })

  it('relays selection, drops and console output', async () => {
    const { w, send } = await setup()
    send({ type: 'ready', protocolVersion: 1 })
    send({ type: 'block-selected', blockId: 'b2' })
    send({ type: 'block-hover', blockId: 'b3' })
    send({ type: 'block-rect', blockId: 'b2', rect: { x: 1, y: 2, width: 3, height: 4 } })
    send({
      type: 'block-rect',
      blockId: 'b3',
      rect: { x: 1, y: 2, width: 3, height: 4 },
      grid: { width: 900, stacked: false },
    })
    send({ type: 'drop', parentId: null, index: 2 })
    send({ type: 'console', level: 'warn', args: ['careful', { n: 1 }] })
    await flushPromises()
    expect(w.emitted('select')?.[0]).toEqual(['b2'])
    expect(w.emitted('hover')?.[0]).toEqual(['b3'])
    expect(w.emitted('rect')?.[0]).toEqual([{ blockId: 'b2', rect: { x: 1, y: 2, width: 3, height: 4 } }])
    expect(w.emitted('rect')?.[1]).toEqual([
      { blockId: 'b3', rect: { x: 1, y: 2, width: 3, height: 4 }, grid: { width: 900, stacked: false } },
    ])
    expect(w.emitted('drop')?.[0]).toEqual([{ type: 'drop', parentId: null, index: 2 }])
    expect(w.emitted('log')?.[0]).toEqual([{ level: 'warn', text: 'careful {"n":1}' }])
    w.unmount()
  })

  it('catches a Studio drag over the frame and drops where the Sandbox resolves the release point', async () => {
    const { w, post, send } = await setup()
    send({ type: 'ready', protocolVersion: 1 })
    await flushPromises()
    await w.setProps({ dragging: true })
    const catcher = w.find('.absolute.inset-0.z-10')
    expect(catcher.exists()).toBe(true)
    post.mockClear()

    await catcher.trigger('drop', { clientX: 40, clientY: 30 })
    const over = post.mock.calls.map((c) => (c[0] as { payload: { type: string } }).payload)
    expect(over[0]).toMatchObject({ type: 'drag-over' })
    send({ type: 'drop-target', parentId: 'cell~1', index: 0 })
    await flushPromises()
    expect(w.emitted('drop')?.[0]).toEqual([{ parentId: 'cell~1', index: 0 }])
    w.unmount()
  })

  it('maps the release point through the iframe even when the drag catcher is already gone', async () => {
    const { w, post, send } = await setup()
    send({ type: 'ready', protocolVersion: 1 })
    await flushPromises()
    // The canvas is zoomed to 50% and offset: 500 screen px show the iframe's 1000 CSS px.
    const iframe = w.find('iframe').element as HTMLIFrameElement
    iframe.getBoundingClientRect = () => ({ left: 100, top: 50, width: 500, height: 400 }) as DOMRect
    Object.defineProperty(iframe, 'offsetWidth', { value: 1000 })
    await w.setProps({ dragging: true })
    const catcher = w.find('.absolute.inset-0.z-10')
    post.mockClear()

    // The palette ends the drag before the catcher hears the drop, so the catcher measures as
    // detached (an empty rect); the point must still come out in iframe pixels.
    await catcher.trigger('drop', { clientX: 150, clientY: 70 })
    const over = post.mock.calls.map((c) => (c[0] as { payload: { type: string } }).payload)
    expect(over[0]).toEqual({ type: 'drag-over', point: { x: 100, y: 40 } })
    w.unmount()
  })

  it('sends the page script patches after every init and when they change', async () => {
    const save = { blockId: 'save', path: 'props', value: { label: 'Save', disabled: true } }
    const { w, post, send } = await setup({ mode: 'preview', patches: [save] })
    const types = () => post.mock.calls.map((c) => (c[0] as { payload: { type: string } }).payload)
    send({ type: 'ready', protocolVersion: 1 })
    await flushPromises()
    const sent = types()
    expect(sent.map((m) => m.type)).toEqual(['init', 'select-block', 'patch'])
    expect(sent[2]).toEqual({ type: 'patch', patch: save })

    post.mockClear()
    const hide = { blockId: 'note', path: 'visible_to', value: ['~nobody'] }
    await w.setProps({ patches: [save, hide] })
    await flushPromises()
    expect(types()).toEqual([
      { type: 'patch', patch: save },
      { type: 'patch', patch: hide },
    ])
    w.unmount()
  })

  it('relays block events', async () => {
    const { w, send } = await setup({ mode: 'preview' })
    send({ type: 'ready', protocolVersion: 1 })
    send({ type: 'block-event', blockId: 'save', event: 'click' })
    await flushPromises()
    expect(w.emitted('block-event')?.[0]).toEqual([{ blockId: 'save', event: 'click' }])
    w.unmount()
  })

  it('shows the fallback on a protocol version mismatch', async () => {
    const { w, send } = await setup()
    send({ type: 'ready', protocolVersion: 2 }, URL_, undefined, 2)
    await flushPromises()
    expect(w.text()).toContain('sandbox.version')
    w.unmount()
  })
})
