/**
 * Host side of the page-script sandbox. Starts a Worker per page visit, answers its requests
 * (ctx.call, block loads, confirm) through callbacks, and exposes block overrides that the
 * renderer draws on top of the definition.
 */
import { shallowRef, type ShallowRef } from 'vue'
import type { Block, LifecycleHandler } from '@platon/definition'
import type { BlockOverrides, RecordRow } from '../context'
import {
  forbidden,
  stringify,
  type BlockSnapshot,
  type HostToWorker,
  type LogLevel,
  type WorkerToHost,
} from './protocol'

export interface RuntimeHooks {
  call: (name: string, args: unknown[]) => Promise<unknown>
  load: (block: Block, params: Record<string, unknown> | undefined) => Promise<RecordRow[]>
  navigate: (to: string) => void
  toast: (text: string, tone?: string) => void
  confirm: (text: string) => Promise<boolean>
  log: (level: LogLevel, text: string, src?: string) => void
}

export interface StartOptions {
  source: string
  lifecycle: Record<string, LifecycleHandler[]>
  blocks: Block[]
  route: { path: string; params: Record<string, string>; query: Record<string, string> }
  user: { name: string; role: string }
  today: string
}

/** A handler that blocks the worker longer than this is stopped (e.g. an endless loop). */
const BUSY_LIMIT_MS = 3000

export class PageRuntime {
  readonly overrides: ShallowRef<BlockOverrides> = shallowRef({})
  readonly state: ShallowRef<Record<string, unknown>> = shallowRef({})
  readonly handlers: ShallowRef<string[]> = shallowRef([])
  private worker: Worker | null = null
  private busyTimer: ReturnType<typeof setTimeout> | null = null
  private blocks = new Map<string, Block>()
  private lastParams = new Map<string, Record<string, unknown> | undefined>()

  constructor(private hooks: RuntimeHooks) {}

  start(o: StartOptions) {
    this.stop()
    this.overrides.value = {}
    this.blocks = new Map(o.blocks.map((b) => [b.ref, b]))
    const bad =
      forbidden(o.source) ??
      Object.values(o.lifecycle)
        .flat()
        .map((h) => (h.code ? forbidden(h.code) : null))
        .find(Boolean) ??
      null
    if (bad) {
      this.hooks.log('error', `${bad}. The page script did not run.`, 'sandbox')
      return
    }
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'page-script' })
    this.worker.onmessage = (e: MessageEvent<WorkerToHost>) => void this.onMessage(e.data)
    this.worker.onerror = (e) => {
      e.preventDefault()
      this.hooks.log('error', e.message || 'Page script crashed', 'sandbox')
    }
    const blocks: Record<string, BlockSnapshot> = {}
    for (const b of o.blocks)
      blocks[b.ref] = {
        type: b.type,
        props: {
          title: b.title,
          ...(b.props as Record<string, unknown>),
          visible: true,
          disabled: false,
          rows: [],
          selected: [],
        },
      }
    // JSON round-trip: callers may pass Vue proxies, which structured clone refuses.
    this.post(
      clone({
        t: 'init',
        source: o.source,
        lifecycle: o.lifecycle,
        blocks,
        route: o.route,
        user: o.user,
        today: o.today,
      }) as HostToWorker,
    )
  }

  /** Forward a block event (e.g. "allWorkOrders.rowClick"). */
  emit(ref: string, event: string, arg: unknown) {
    this.post({ t: 'event', key: `${ref}.${event}`, arg: clone(arg) })
  }

  /** Tell the script about rows the host loaded (initial data). */
  provide(ref: string, props: Record<string, unknown>) {
    this.post({ t: 'block', ref, props: clone(props) as Record<string, unknown> })
  }

  stop() {
    if (this.worker) {
      this.post({ t: 'leave' })
      const w = this.worker
      // Give onBeforeLeave / onPageLeave a moment to log, then end the worker.
      setTimeout(() => w.terminate(), 150)
    }
    this.worker = null
    if (this.busyTimer) clearTimeout(this.busyTimer)
  }

  private post(m: HostToWorker) {
    this.worker?.postMessage(m)
  }

  private setOverride(ref: string, patch: Record<string, unknown>) {
    this.overrides.value = {
      ...this.overrides.value,
      [ref]: { ...(this.overrides.value[ref] ?? {}), ...patch },
    }
  }

  private async onMessage(m: WorkerToHost) {
    switch (m.t) {
      case 'set':
        this.setOverride(m.ref, { [m.prop]: m.value })
        break
      case 'state':
        this.state.value = m.state
        break
      case 'ready':
        this.handlers.value = m.handlers
        break
      case 'toast':
        this.hooks.toast(m.text, m.tone)
        break
      case 'navigate':
        this.hooks.navigate(m.to)
        break
      case 'log':
        this.hooks.log(m.level, m.text, m.src)
        break
      case 'busy':
        if (this.busyTimer) clearTimeout(this.busyTimer)
        this.busyTimer = setTimeout(() => {
          this.hooks.log(
            'error',
            `A handler ran longer than ${BUSY_LIMIT_MS / 1000} s and was stopped`,
            'sandbox',
          )
          this.worker?.terminate()
          this.worker = null
        }, BUSY_LIMIT_MS)
        break
      case 'idle':
        if (this.busyTimer) clearTimeout(this.busyTimer)
        this.busyTimer = null
        break
      case 'request':
        try {
          const value = await this.answer(m)
          this.post({ t: 'reply', id: m.id, ok: true, value: clone(value) })
        } catch (e) {
          this.post({ t: 'reply', id: m.id, ok: false, error: stringify(e) })
        }
        break
    }
  }

  private async answer(m: Extract<WorkerToHost, { t: 'request' }>): Promise<unknown> {
    const block = m.ref ? this.blocks.get(m.ref) : undefined
    switch (m.op) {
      case 'call':
        return this.hooks.call(String(m.args[0]), m.args.slice(1))
      case 'confirm':
        return this.hooks.confirm(String(m.args[0] ?? ''))
      case 'load':
      case 'reload': {
        if (!block) throw new Error(`No block “${m.ref}”`)
        const params =
          m.op === 'load'
            ? (m.args[0] as Record<string, unknown> | undefined)
            : this.lastParams.get(block.ref)
        this.lastParams.set(block.ref, params)
        this.setOverride(block.ref, { loading: true })
        const rows = await this.hooks.load(block, params)
        this.setOverride(block.ref, { rows, loading: false })
        this.provide(block.ref, { rows })
        return undefined
      }
      case 'setValue': {
        if (!block) throw new Error(`No block “${m.ref}”`)
        const values = {
          ...((this.overrides.value[block.ref]?.values as Record<string, unknown>) ?? {}),
          [String(m.args[0])]: m.args[1],
        }
        this.setOverride(block.ref, { values })
        this.provide(block.ref, { values })
        return undefined
      }
      case 'reset':
        if (block) this.setOverride(block.ref, { values: {} })
        return undefined
      case 'submit':
        this.hooks.log('info', `${m.ref}.submit()`, m.ref)
        return undefined
      case 'refresh':
        return undefined
    }
  }
}

function clone(v: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(v ?? null)) as unknown
  } catch {
    return null
  }
}
