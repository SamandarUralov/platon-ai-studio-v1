<script setup lang="ts">
/**
 * Preview (F10): the whole app as a chosen role, with Development records, the app's languages and
 * viewport sizes. The app runs in the Platon Sandbox iframe (Preview mode, mock data); the page
 * script and lifecycle run in the Studio's Worker sandbox (usePreviewRuntime) and act on the
 * Sandbox through block events and patches. Console output and errors feed the Code console.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLocalStorage, usePreferredDark, useResizeObserver } from '@vueuse/core'
import { PenTool, RotateCcw, ShieldCheck, SquareTerminal } from 'lucide-vue-next'
import { PButton, PSegmented, PSelect } from '@platon/ui'
import { canOpenPage, statsSource, useScriptLogs } from '@platon/renderer'
import SandboxFrame from '@/components/sandbox/SandboxFrame.vue'
import { toSandboxMeta } from '@/services/sandbox/meta'
import ViewportPopover from '@/features/interface/components/ViewportPopover.vue'
import { tablesFor, useTableRecords } from '@/features/interface/api'
import { useInterfaceStore } from '@/features/interface/store'
import { fitZoom } from '@/features/interface/lib/viewport'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { activeRules } from './rules'
import { usePreviewRuntime } from './usePreviewRuntime'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const def = useDefinitionStore()
const session = useSessionStore()
const pid = useProjectId()
const prefersDark = usePreferredDark()
const ifc = useInterfaceStore()
const logs = useScriptLogs()

const definition = computed(() => def.definition!)
const pages = computed(() => definition.value.interface.pages)
const role = useLocalStorage('platon.previewRole', 'admin')
watch(
  () => definition.value.roles,
  (rs) => {
    if (!rs.some((r) => r.id === role.value) && rs[0]) role.value = rs[0].id
  },
  { immediate: true },
)
const roleName = computed(() => definition.value.roles.find((r) => r.id === role.value)?.name ?? role.value)
/** Demo people per role so "assigned to me" rules have someone to match. */
const PEOPLE: Record<string, string> = {
  dispatcher: 'Jordan Lee',
  technician: 'Sam Ortiz',
  customer: 'Dana Brooks',
}
const user = computed(() => ({
  name: PEOPLE[role.value] ?? session.user?.name ?? 'Maya Chen',
  role: roleName.value,
}))
const lang = ref(definition.value.settings.defaultLanguage)
const langs = computed(() =>
  definition.value.settings.languages.map((l) => ({ value: l, label: l.toUpperCase() })),
)

const visiblePages = computed(() => pages.value.filter((p) => canOpenPage(p, role.value)))
const pageId = computed(() =>
  route.params.pageId ? String(route.params.pageId) : (visiblePages.value[0]?.id ?? pages.value[0]?.id),
)
const page = computed(() => pages.value.find((p) => p.id === pageId.value))

// viewport
const width = useLocalStorage('platon.previewWidth', 1440)
const zoom = useLocalStorage<'fit' | number>('platon.previewZoom', 'fit', {
  serializer: { read: (v) => (v === 'fit' ? 'fit' : Number(v) || 'fit'), write: (v) => String(v) },
})
const stage = ref<HTMLElement>()
const available = ref(1200)
useResizeObserver(stage, (e) => (available.value = e[0]!.contentRect.width))
const z = computed(() => (zoom.value === 'fit' ? fitZoom(width.value, available.value, 40) : zoom.value))

// data: every page's tables, since the Sandbox navigates between pages on its own
const tableIds = computed(() => {
  const stats = statsSource(definition.value)
  return [...new Set(pages.value.flatMap((p) => tablesFor(p, stats)))]
})
const records = useTableRecords(pid, tableIds)
// Lifecycle runs in the Studio's page runtime with the page script, not in the Sandbox.
const metaOptions = computed(() => ({
  records: records.value,
  lang: lang.value,
  prefersDark: prefersDark.value,
  viewer: user.value.name,
  lifecycle: false,
}))
const build = computed(() => toSandboxMeta(definition.value, metaOptions.value))
const meta = computed(() => build.value.meta)

function navigate(id: string) {
  void router.push(projectLinks(pid.value).preview(id))
}
const script = usePreviewRuntime({
  definition,
  page,
  role,
  user,
  records,
  nodes: computed(() => build.value.nodes),
  metaOptions,
  navigate,
  projectId: pid,
})
/** Remounts the Sandbox and restarts the page script: state, lifecycle and data start over. */
const run = ref(0)
function restart() {
  run.value++
  script.restart()
}

function onLog(e: { level: 'log' | 'info' | 'warn' | 'error'; text: string; src?: string }) {
  if (page.value) logs.push({ pageId: page.value.id, ...e, role: user.value.role })
}

const rules = computed(() => (page.value ? activeRules(definition.value, page.value, role.value, t) : []))
const orders = computed(() => records.value.work_orders)
const summary = computed(
  () =>
    t('preview.summary', { pages: visiblePages.value.length, total: pages.value.length }) +
    (orders.value ? ` · ${t('preview.records', { n: orders.value.length })}` : ''),
)
const pageLogs = computed(() => logs.entries.value.filter((l) => l.pageId === page.value?.id).length)
const roleOptions = computed(() => definition.value.roles.map((r) => ({ value: r.id, label: r.name })))

function edit() {
  ifc.mode = 'design'
  void router.push(projectLinks(pid.value).interface(page.value?.id))
}
function openConsole() {
  ifc.mode = 'code'
  void router.push(projectLinks(pid.value).interface(page.value?.id))
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-bg">
    <div class="flex h-14 shrink-0 items-center gap-3 border-b border-line-2 bg-surface px-3.5">
      <span class="text-sm text-muted">{{ t('preview.as') }}</span>
      <PSelect v-model="role" :options="roleOptions" class="w-48" :aria-label="t('preview.as')" />
      <PSegmented
        v-if="langs.length > 1"
        v-model="lang"
        :options="langs"
        :aria-label="t('preview.language')"
      />
      <ViewportPopover v-model:width="width" v-model:zoom="zoom" :effective-zoom="z" />
      <PButton variant="ghost" :icon="RotateCcw" :title="t('preview.restartHint')" @click="restart()">{{
        t('preview.restart')
      }}</PButton>
      <div class="ml-auto flex items-center gap-2">
        <PButton variant="ghost" :icon="SquareTerminal" @click="openConsole"
          >{{ t('preview.console')
          }}<span v-if="pageLogs" class="rounded-full bg-subtle px-1.5 text-2xs font-bold text-muted">{{
            pageLogs
          }}</span></PButton
        >
        <PButton :icon="PenTool" @click="edit">{{ t('preview.edit') }}</PButton>
      </div>
    </div>
    <div
      class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 bg-primary-soft px-3.5 py-2 text-sm"
    >
      <ShieldCheck :size="15" class="text-primary-strong" />
      <span
        ><b>{{ user.name }} · {{ roleName }}</b> {{ summary }}</span
      >
      <span
        v-for="r in rules"
        :key="r"
        class="rounded-md bg-surface px-2 py-0.5 text-xs text-fg-2 shadow-xs"
        >{{ r }}</span
      >
    </div>
    <div ref="stage" class="min-h-0 flex-1 overflow-auto bg-canvas bg-dots px-5 pt-5 pb-10 scroll-thin">
      <div class="mx-auto" :style="{ width: `${width}px`, zoom: z }">
        <div class="pb-2 font-mono text-xs font-semibold text-faint">
          {{ width }}px · {{ Math.round(z * 100) }}%
        </div>
        <div
          class="h-[calc((100vh_-_200px)/var(--z))] min-h-[560px] overflow-hidden rounded-[14px] border border-line shadow-card"
          :style="{ '--z': z }"
        >
          <SandboxFrame
            :key="run"
            :meta="meta"
            mode="preview"
            data="mock"
            :page-id="pageId"
            :role="role"
            :patches="script.patches.value"
            @block-event="script.onBlockEvent"
            @page="navigate"
            @role="(r) => r && (role = r)"
            @log="onLog"
          />
        </div>
      </div>
    </div>
  </div>
</template>
