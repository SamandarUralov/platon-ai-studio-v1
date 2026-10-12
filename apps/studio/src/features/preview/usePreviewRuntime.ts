/**
 * Runs the current page's script (and its lifecycle) for Preview in the Worker sandbox and joins it
 * to the Platon Sandbox that draws the app: block events from the Sandbox become `<ref>.<event>`
 * handler calls, and what the script sets on `ctx.blocks` goes back as patches. Toasts, navigation,
 * ctx.call (mocked), block loads (Development records) and the shared console are wired here.
 */
import { computed, onBeforeUnmount, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { toast } from '@platon/ui'
import type { AppDefinition, Page, PageScript } from '@platon/definition'
import { PageRuntime, useScriptLogs, type RecordRow } from '@platon/renderer'
import type { SandboxToStudio } from '@platon/bridge/sandbox'
import { useQueryClient } from '@tanstack/vue-query'
import { useDraftsStore } from '@/stores/drafts'
import { ownerBlock, type SandboxNode, type SandboxMetaOptions } from '@/services/sandbox/meta'
import { definitionEvent, overridePatches } from '@/services/sandbox/overrides'
import { fetchRecords } from '@/features/interface/api'
import { filterByParams, matchRoute, mockCall } from './mockCall'

interface Options {
  definition: ComputedRef<AppDefinition>
  page: ComputedRef<Page | undefined>
  role: Ref<string>
  user: ComputedRef<{ name: string; role: string }>
  records: ComputedRef<Record<string, RecordRow[] | undefined>>
  /** Node map of the meta the Sandbox draws, to resolve its block ids. */
  nodes: ComputedRef<Map<string, SandboxNode>>
  /** Same options the Sandbox meta was built with, so patches match it. */
  metaOptions: ComputedRef<SandboxMetaOptions>
  navigate: (pageId: string) => void
  projectId: ComputedRef<string>
}

const TONES = { ok: 'ok', warn: 'warn', danger: 'danger', info: 'neutral' } as const

export function usePreviewRuntime(o: Options) {
  const drafts = useDraftsStore()
  const queryClient = useQueryClient()
  const logs = useScriptLogs()
  const log = (level: 'log' | 'info' | 'warn' | 'error', text: string, src?: string) =>
    o.page.value && logs.push({ pageId: o.page.value.id, level, text, src, role: o.user.value.role })

  const runtime = new PageRuntime({
    call: async (name, args) => {
      log(
        'info',
        `ctx.call('${name}'${args.length ? `, ${args.map((a) => JSON.stringify(a)).join(', ')}` : ''}) → mocked result`,
        name,
      )
      await new Promise((r) => setTimeout(r, 250))
      return mockCall(o.definition.value, name)
    },
    load: async (block, params) => {
      const src = (block.props as { source?: string }).source
      if (!src) return []
      // The script may load before the page's queries finish; share their cache instead of racing them.
      const rows =
        o.records.value[src] ??
        (await queryClient.fetchQuery({
          queryKey: ['records', o.projectId.value, src],
          queryFn: () => fetchRecords(o.projectId.value, src),
        }))
      return filterByParams(o.definition.value, src, rows ?? [], params)
    },
    navigate: (to) => {
      const target = o.definition.value.interface.pages.find((p) => matchRoute(p.route, to))
      if (target) return o.navigate(target.id)
      toast(`No page at ${to}`, { tone: 'warn' })
      log('warn', `ctx.navigate('${to}'): no page has this route`, 'navigate')
    },
    toast: (text, tone) => toast(text, { tone: TONES[(tone ?? 'info') as keyof typeof TONES] ?? 'neutral' }),
    confirm: async (text) => window.confirm(text),
    log,
  })

  function source(page: Page): string {
    const draft = drafts.value<PageScript>(`/interface/pages/${page.id}/script`)
    return draft?.source ?? page.script?.source ?? ''
  }

  /** The page the runtime was started for: overrides belong to it, not to whatever is current. */
  const running = shallowRef<Page | null>(null)

  function start() {
    const page = o.page.value
    running.value = page ?? null
    if (!page) return runtime.stop()
    runtime.start({
      source: source(page),
      lifecycle: page.lifecycle ?? {},
      blocks: page.blocks,
      route: { path: page.route, params: {}, query: {} },
      user: o.user.value,
      today: new Date().toISOString().slice(0, 10),
    })
    provideRows()
  }

  /** Give data blocks their initial rows so `ctx.blocks.x.rows` works before any load(). */
  function provideRows() {
    for (const b of running.value?.blocks ?? []) {
      const src = (b.props as { source?: string }).source
      const rows = src ? o.records.value[src] : undefined
      if (rows) runtime.provide(b.ref, { rows })
    }
  }

  /** A Sandbox block event → the page script's `on: { '<ref>.<event>' }` handler. */
  function onBlockEvent(e: SandboxToStudio['block-event']) {
    const page = running.value
    const id = ownerBlock(o.nodes.value, e.blockId)
    const block = page?.blocks.find((b) => b.id === id)
    const name = block && definitionEvent(block.type, e.event)
    if (block && name) runtime.emit(block.ref, name, e.payload)
  }

  const patches = computed(() =>
    running.value && o.page.value?.id === running.value.id
      ? overridePatches(o.definition.value, o.page.value, runtime.overrides.value, o.metaOptions.value)
      : [],
  )

  watch(() => [o.page.value?.id, o.role.value], start, { immediate: true })
  watch(o.records, provideRows)
  onBeforeUnmount(() => runtime.stop())

  return { patches, onBlockEvent, restart: start }
}
