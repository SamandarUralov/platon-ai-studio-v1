/**
 * Page-script sandbox. Runs inside a dedicated module Worker: no DOM, and network/import globals are
 * removed before user code loads. Page code only talks to the outside world through `ctx`, which
 * turns every effect into a message for the host.
 */
import {
  BLOCK_METHODS,
  handlerModule,
  stringify,
  type BlockSnapshot,
  type HostToWorker,
  type RequestOp,
  type WorkerToHost,
} from './protocol'

type Scope = Record<string, unknown> & {
  postMessage: (m: WorkerToHost) => void
  onmessage: ((e: MessageEvent<HostToWorker>) => void) | null
}
const scope = self as unknown as Scope
const post = scope.postMessage.bind(scope)

for (const g of [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'BroadcastChannel',
  'Request',
]) {
  try {
    Object.defineProperty(scope, g, { value: undefined, configurable: false, writable: false })
  } catch {
    // Some globals are non-configurable in some engines; the source check still blocks them.
  }
}

type Handler = (ctx: unknown, arg?: unknown) => unknown
interface PageModule {
  state?: Record<string, unknown> | (() => Record<string, unknown>)
  computed?: Record<string, (ctx: unknown) => unknown>
  on?: Record<string, Handler>
  [hook: string]: unknown
}

scope.definePage = (p: PageModule) => p

let page: PageModule = {}
let blocks: Record<string, BlockSnapshot> = {}
const lifecycle: Record<string, Handler[]> = {}
let state: Record<string, unknown> = {}
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function request(op: RequestOp, ref: string | undefined, args: unknown[]): Promise<unknown> {
  const id = ++seq
  post({ t: 'request', id, op, ref, args: JSON.parse(JSON.stringify(args ?? [])) as unknown[] })
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

const blockProxies = new Map<string, unknown>()
function blockProxy(ref: string): unknown {
  if (!blocks[ref]) return undefined
  let p = blockProxies.get(ref)
  if (p) return p
  p = new Proxy(
    {},
    {
      get(_, prop: string) {
        if ((BLOCK_METHODS as readonly string[]).includes(prop)) {
          if (prop === 'field')
            return (name: string) => ({
              name,
              value: (blocks[ref]?.props.values as Record<string, unknown> | undefined)?.[name],
            })
          return (...args: unknown[]) => request(prop as RequestOp, ref, args)
        }
        return blocks[ref]?.props[prop]
      },
      set(_, prop: string, value: unknown) {
        const b = blocks[ref]
        if (!b) return false
        b.props[prop] = value
        post({ t: 'set', ref, prop, value: JSON.parse(JSON.stringify(value ?? null)) as unknown })
        return true
      },
    },
  )
  blockProxies.set(ref, p)
  return p
}

let route: Extract<HostToWorker, { t: 'init' }>['route'] = { path: '/', params: {}, query: {} }
let user = { name: '', role: '' }
let today = ''

const ctx: Record<string, unknown> = {
  blocks: new Proxy({}, { get: (_, ref: string) => blockProxy(ref) }),
  get state() {
    return state
  },
  call: (name: string, ...args: unknown[]) => request('call', undefined, [name, ...args]),
  navigate: (to: string) => post({ t: 'navigate', to: String(to) }),
  toast: (text: unknown, tone?: string) => post({ t: 'toast', text: stringify(text), tone }),
  confirm: (text: unknown) => request('confirm', undefined, [stringify(text)]),
  log: (...args: unknown[]) => post({ t: 'log', level: 'log', text: args.map(stringify).join(' ') }),
  today: () => today,
  get route() {
    return route
  },
  get user() {
    return user
  },
  computed: {},
}

function syncState() {
  try {
    post({ t: 'state', state: JSON.parse(JSON.stringify(state)) as Record<string, unknown> })
  } catch {
    // Non-serialisable state stays inside the worker.
  }
}

async function run(fn: Handler | undefined, arg: unknown, src: string): Promise<void> {
  if (typeof fn !== 'function') return
  post({ t: 'busy' })
  try {
    const r = fn(ctx, arg)
    post({ t: 'idle' })
    await r
  } catch (e) {
    post({ t: 'idle' })
    post({ t: 'log', level: 'error', text: stringify(e), src })
    for (const h of lifecycle.onPageError ?? []) await Promise.resolve(h(ctx, e)).catch(() => undefined)
  } finally {
    syncState()
  }
}

async function load(code: string): Promise<unknown> {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    const m = (await import(/* @vite-ignore */ url)) as { default?: unknown }
    return m.default
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function runHook(name: string) {
  for (const [i, h] of (lifecycle[name] ?? []).entries()) await run(h, undefined, `${name} #${i + 1}`)
  const own = page[name]
  if (typeof own === 'function') await run(own as Handler, undefined, name)
}

async function init(msg: Extract<HostToWorker, { t: 'init' }>) {
  blocks = msg.blocks
  route = msg.route
  user = msg.user
  today = msg.today
  try {
    page = ((msg.source.trim() ? await load(msg.source) : null) as PageModule | null) ?? {}
  } catch (e) {
    post({ t: 'log', level: 'error', text: `Page code didn’t load: ${stringify(e)}`, src: 'page' })
    page = {}
  }
  for (const [hook, hs] of Object.entries(msg.lifecycle)) {
    lifecycle[hook] = []
    for (const h of hs) {
      try {
        lifecycle[hook].push((await load(handlerModule(h))) as Handler)
      } catch (e) {
        post({ t: 'log', level: 'error', text: `${hook}: ${stringify(e)}`, src: hook })
      }
    }
  }
  const s = page.state
  state = structuredClone(typeof s === 'function' ? s() : (s ?? {}))
  const computed: Record<string, unknown> = {}
  for (const [k, f] of Object.entries(page.computed ?? {}))
    Object.defineProperty(computed, k, { get: () => f(ctx), enumerable: true })
  ctx.computed = computed
  syncState()
  post({ t: 'ready', handlers: Object.keys(page.on ?? {}) })
  await runHook('onPageInit')
  await runHook('onBeforeRender')
  await run(page.onLoad as Handler | undefined, undefined, 'onLoad')
  await runHook('onPageReady')
}

scope.onmessage = (e: MessageEvent<HostToWorker>) => {
  const m = e.data
  if (m.t === 'init') void init(m)
  else if (m.t === 'event') void run(page.on?.[m.key], m.arg, m.key)
  else if (m.t === 'block') {
    blocks[m.ref] = {
      ...(blocks[m.ref] ?? { type: 'unknown', props: {} }),
      props: { ...(blocks[m.ref]?.props ?? {}), ...m.props },
    }
  } else if (m.t === 'reply') {
    const p = pending.get(m.id)
    pending.delete(m.id)
    if (m.ok) p?.resolve(m.value)
    else p?.reject(new Error(m.error ?? 'Request failed'))
  } else if (m.t === 'leave') {
    void runHook('onBeforeLeave').then(() => runHook('onPageLeave'))
  }
}
