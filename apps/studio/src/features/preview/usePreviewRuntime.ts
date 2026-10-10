/**
 * Runs the current page's script in the Worker sandbox for Preview and wires its effects:
 * toasts, navigation, ctx.call (mocked), block loads (Development records) and the shared console.
 */
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import { toast } from '@platon/ui'
import type { AppDefinition, Page, PageScript } from '@platon/definition'
import { PageRuntime, useScriptLogs, type RecordRow } from '@platon/renderer'
import { useQueryClient } from '@tanstack/vue-query'
import { useDraftsStore } from '@/stores/drafts'
import { fetchRecords } from '@/features/interface/api'
import { filterByParams, matchRoute, mockCall } from './mockCall'

interface Options {
  definition: ComputedRef<AppDefinition>
  page: ComputedRef<Page | undefined>
  role: Ref<string>
  user: ComputedRef<{ name: string; role: string }>
  records: ComputedRef<Record<string, RecordRow[] | undefined>>
  route: ComputedRef<{ path: string; params: Record<string, string>; query: Record<string, string> }>
  navigate: (pageId: string, params?: Record<string, string>) => void
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
      for (const p of o.definition.value.interface.pages) {
        const params = matchRoute(p.route, to)
        if (params) return o.navigate(p.id, params)
      }
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

  function start() {
    const page = o.page.value
    if (!page) return runtime.stop()
    runtime.start({
      source: source(page),
      lifecycle: page.lifecycle ?? {},
      blocks: page.blocks,
      route: o.route.value,
      user: o.user.value,
      today: new Date().toISOString().slice(0, 10),
    })
    provideRows()
  }

  /** Give table blocks their initial rows so `ctx.blocks.x.rows` works before any load(). */
  function provideRows() {
    for (const b of o.page.value?.blocks ?? []) {
      const src = (b.props as { source?: string }).source
      const rows = src ? o.records.value[src] : undefined
      if (rows) runtime.provide(b.ref, { rows })
    }
  }

  watch(() => [o.page.value?.id, o.role.value, o.route.value.path], start, { immediate: true })
  watch(o.records, provideRows)
  onBeforeUnmount(() => runtime.stop())

  return { runtime, restart: start }
}
