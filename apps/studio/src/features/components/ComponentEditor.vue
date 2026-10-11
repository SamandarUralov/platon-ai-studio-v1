<script setup lang="ts">
/**
 * Component screen. Embeds the Constructor (separate origin, iframe + bridge) when it answers; otherwise
 * falls back to the built-in editor: .vue source + meta.json, live preview, Properties and Inputs.
 * Props live in the definition (changes, area Components); the source lives in the sandbox (draft → save).
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useElementSize } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  Braces,
  Check,
  CircleCheck,
  Circle,
  CodeXml,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  FilePlus2,
  LoaderCircle,
  Monitor,
  Plus,
  Puzzle,
  RefreshCw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  TriangleAlert,
} from 'lucide-vue-next'
import { PButton, PCodeEditor, PEmptyState, PSegmented, PSpinner, PTooltip, toast } from '@platon/ui'
import type { ComponentMeta, ConstructorStatus } from '@platon/bridge'
import type { ComponentProp, CustomComponent, SandboxFileContent } from '@platon/definition'
import SaveBar from '@/components/common/SaveBar.vue'
import JsonView from '@/components/common/JsonView.vue'
import LayerShell from '@/components/shell/LayerShell.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useShortcuts } from '@/composables/useShortcuts'
import { projectLinks } from '@/composables/useProject'
import { errorMessage } from '@/services/http'
import { componentKeys, saveSandboxFile, useSandboxFile, useSandboxFiles } from './api'
import ConstructorFrame, {
  constructorKnownDown,
  constructorOrigin,
  forgetConstructorProbe,
} from './ConstructorFrame.vue'
import CustomComponentPreview from './CustomComponentPreview.vue'
import InputsPanel from './InputsPanel.vue'
import PropsEditor from './PropsEditor.vue'
import SandboxFileTree from './SandboxFileTree.vue'
import StatusChip, { type DisplayStatus } from './StatusChip.vue'
import {
  buildMeta,
  parseEmits,
  parseProps,
  propsFromCode,
  scaffoldSource,
  shortId,
  syncProps,
  syncState,
} from './sfc'
import { generations, useComponentActions, useSamples } from './useComponents'
import HideLeftPanel from '@/components/shell/HideLeftPanel.vue'

const props = defineProps<{ projectId: string; componentId: string }>()
const emit = defineEmits<{ create: [method: 'ai' | 'code'] }>()
const { t } = useI18n()
const router = useRouter()
const qc = useQueryClient()
const def = useDefinitionStore()
const session = useSessionStore()
const ui = useUiStore()
const actions = useComponentActions()
const links = computed(() => projectLinks(props.projectId))

const pid = computed(() => props.projectId)
const component = computed(() => def.definition?.components.find((c) => c.id === props.componentId) ?? null)
const job = computed(() => (component.value ? generations.get(component.value.id) : undefined))
const building = computed(() => !!job.value && job.value.step < 4)

// ── Source file (draft model) ─────────────────────────────────────────────────────────────────

const files = useSandboxFiles(pid)
const filePath = computed(() => (building.value ? null : (component.value?.file ?? null)))
const file = useSandboxFile(pid, filePath)
const saved = ref<string | null>(null)
const draft = ref('')
const saving = ref(false)
const dirty = computed(() => saved.value !== null && draft.value !== saved.value)
const fileMissing = computed(() => !building.value && file.isError.value)
let loadedPath: string | null = null

watch(
  () => [file.data.value, filePath.value] as const,
  ([data, path]) => {
    if (!data || data.path !== path) return
    if (saved.value !== null && dirty.value && loadedPath === path) return
    loadedPath = path
    saved.value = data.content
    draft.value = data.content
  },
  { immediate: true },
)
watch(filePath, (p) => {
  if (p !== loadedPath) {
    saved.value = null
    draft.value = ''
  }
})

const shownSource = computed(() => {
  const j = job.value
  if (j && j.step < 4) return j.source.split('\n').slice(0, j.shownLines).join('\n')
  return draft.value
})

async function save(silent = false) {
  const c = component.value
  if (!c || saved.value === null || saving.value) return
  const content = draft.value
  saving.value = true
  try {
    const res = await saveSandboxFile(props.projectId, c.file, { content })
    saved.value = res.content
    qc.setQueryData<SandboxFileContent>(componentKeys.file(props.projectId, c.file), res)
    void qc.invalidateQueries({ queryKey: componentKeys.files(props.projectId) })
    const evs = parseEmits(content)
    if (evs.join('|') !== c.events.join('|')) actions.setEvents(c, evs)
    if (!silent) toast(t('components.saved', { file: c.file }), { tone: 'ok' })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    saving.value = false
  }
}
function discard() {
  if (saved.value !== null) draft.value = saved.value
}

async function createMissingFile() {
  const c = component.value
  if (!c) return
  try {
    const content = syncProps(scaffoldSource(c.name), c.props)
    const res = await saveSandboxFile(props.projectId, c.file, {
      content,
      componentId: c.id,
      origin: c.source.type,
    })
    qc.setQueryData<SandboxFileContent>(componentKeys.file(props.projectId, c.file), res)
    void qc.invalidateQueries({ queryKey: componentKeys.files(props.projectId) })
    void file.refetch()
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}

useShortcuts([{ keys: 'mod+s', run: () => (dirty.value ? void save() : false) }])

// ── Props ↔ code ──────────────────────────────────────────────────────────────────────────────

const events = computed(() =>
  saved.value !== null ? parseEmits(draft.value) : (component.value?.events ?? []),
)
const sync = computed(() =>
  component.value && saved.value !== null && !building.value
    ? syncState(draft.value, component.value.props)
    : null,
)

function onPropsChange(list: ComponentProp[], text: string) {
  const c = component.value
  if (!c) return
  const wasClean = !dirty.value
  if (!actions.setProps(c, list, text)) return
  if (saved.value === null) return
  draft.value = syncProps(draft.value, list)
  // Keep the saved file in step with the definition unless the user has unsaved code edits.
  if (wasClean && dirty.value) void save(true)
}

function rewriteFromProps() {
  const c = component.value
  if (!c) return
  draft.value = syncProps(draft.value, c.props)
  toast(t('components.sync.rewritten'))
}

function importFromCode() {
  const c = component.value
  const s = sync.value
  if (!c || s?.kind !== 'codeOnly') return
  const parsed = (parseProps(draft.value) ?? []).filter((p) => s.names.includes(p.name))
  const added = propsFromCode(parsed)
  actions.setProps(c, [...c.props, ...added], `Added ${s.names.join(', ')} to Properties of “${c.name}”`)
  toast(t('components.sync.imported', added.length), { tone: 'ok' })
}

// ── Status ────────────────────────────────────────────────────────────────────────────────────

const embeddedStatus = ref<ConstructorStatus | null>(null)
const status = computed<DisplayStatus>(() => {
  const c = component.value
  if (!c) return 'needs_review'
  if (building.value || c.status === 'building') return 'building'
  if (mode.value === 'embedded' && embeddedStatus.value) return embeddedStatus.value
  if (c.status === 'needs_review') return 'needs_review'
  if (sync.value && sync.value.kind !== 'ok') return 'out_of_sync'
  return c.status
})

function markReviewed() {
  const c = component.value
  if (!c) return
  actions.setStatus(c, 'reviewed', `Reviewed “${c.name}”`)
  toast(t('components.reviewed', { name: c.name }), { tone: 'ok' })
}
function resumeReview(c: CustomComponent) {
  actions.setStatus(c, 'needs_review', `“${c.name}” is ready for review`)
}

// ── Constructor iframe or built-in editor ─────────────────────────────────────────────────────

const mode = ref<'probing' | 'embedded' | 'builtin'>(constructorKnownDown() ? 'builtin' : 'probing')
const versionMismatch = ref<{ got: number; want: number } | null>(null)
const embeddedDirty = ref(false)
const frame = shallowRef<InstanceType<typeof ConstructorFrame> | null>(null)
const origin = constructorOrigin()

function retryConstructor() {
  forgetConstructorProbe()
  versionMismatch.value = null
  mode.value = 'probing'
}
function useBuiltin() {
  mode.value = 'builtin'
}

function onGuestMeta(meta: ComponentMeta) {
  const c = component.value
  if (!c || meta.id !== c.id) return
  const next: ComponentProp[] = meta.props.map((m) => {
    const prev = c.props.find((p) => p.name === m.name)
    const p: ComponentProp = {
      name: m.name,
      label: m.label,
      type: m.type,
      input: m.input as ComponentProp['input'],
      required: m.required,
    }
    if (m.default !== undefined) p.default = m.default
    if (m.options) p.options = m.options
    if (prev?.ai) p.ai = true
    return p
  })
  if (JSON.stringify(next) !== JSON.stringify(c.props))
    actions.setProps(c, next, `Updated properties of “${c.name}” in the Constructor`)
  if (meta.events.join('|') !== c.events.join('|')) actions.setEvents(c, meta.events)
}
function onGuestNavigate(to: string) {
  // Only Studio-internal paths; never let the frame send us elsewhere.
  if (/^\/(?!\/)/.test(to)) void router.push(to)
}

// ── Preview, samples, viewport ────────────────────────────────────────────────────────────────

const samples = useSamples(() => component.value?.id)
const centreTab = ref<'code' | 'meta'>('code')
const previewOn = ref(true)
const rightTab = ref<'props' | 'inputs'>('props')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const VIEWPORTS = {
  desktop: { w: '100%', px: 0, icon: Monitor },
  tablet: { w: '600px', px: 600, icon: Tablet },
  mobile: { w: '360px', px: 360, icon: Smartphone },
} as const
const viewportOptions = computed(() =>
  (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]).map((k) => ({
    value: k,
    icon: VIEWPORTS[k].icon,
    title: t(`components.viewport.${k}`),
  })),
)
const splitEl = ref<HTMLElement>()
const { width: splitW } = useElementSize(splitEl)
const stacked = computed(() => splitW.value > 0 && splitW.value < 640)

const meta = computed(() => (component.value ? buildMeta(component.value, events.value) : null))
async function copyMeta() {
  if (!meta.value) return
  await navigator.clipboard.writeText(JSON.stringify(meta.value, null, 2))
  toast(t('components.copiedMeta'))
}

// ── Add to page ───────────────────────────────────────────────────────────────────────────────

const targetPage = computed(() => {
  const pages = def.definition?.interface.pages ?? []
  const prefix = `/p/${props.projectId}/interface/`
  for (const r of ui.recent) {
    if (r.layer !== 'interface' || !r.path.startsWith(prefix)) continue
    const id = r.path.slice(prefix.length).split(/[/?#]/)[0]
    const p = pages.find((x) => x.id === id)
    if (p) return p
  }
  return pages[0] ?? null
})
function addToPage() {
  const c = component.value
  const page = targetPage.value
  if (!c || building.value) return
  if (!page) return toast(t('components.noPage'), { tone: 'warn' })
  if (actions.addToPage(c, page.id))
    toast(t('components.added', { name: c.name, page: page.name }), {
      tone: 'ok',
      action: {
        label: t('components.openPage'),
        run: () => void router.push(links.value.interface(page.id)),
      },
    })
}

const genSteps = computed(() => {
  const j = job.value
  if (!j) return []
  return [
    [t('components.gen.create', { path: j.path }), 1],
    [t('components.gen.write'), 2],
    [t('components.gen.props'), 3],
  ].map(([label, k]) => ({
    label: String(label),
    state: j.step > Number(k) ? 'done' : j.step === Number(k) ? 'on' : 'todo',
  }))
})

function open(id: string) {
  void router.push(links.value.components(shortId(id)))
}
</script>

<template>
  <LayerShell :left-min="220" :right-min="320">
    <template #left>
      <div class="flex h-12 shrink-0 items-center gap-1.5 border-b border-line-faint pl-2 pr-2.5">
        <PButton
          variant="ghost"
          size="sm"
          :icon="ArrowLeft"
          @click="router.push(links.interface(targetPage?.id))"
          >{{ t('components.back') }}</PButton
        >
        <PButton class="ml-auto" size="xs" :icon="Plus" @click="emit('create', 'code')">{{
          t('components.newShort')
        }}</PButton>
        <PButton
          variant="ai"
          size="xs"
          square
          :icon="Sparkles"
          :label="t('components.askAi')"
          @click="emit('create', 'ai')"
        />
        <HideLeftPanel />
      </div>
      <SandboxFileTree
        :files="files.data.value"
        :components="def.definition?.components ?? []"
        :selected-id="componentId"
        :loading="files.isLoading.value"
        @select="open"
      />
      <div class="border-t border-line-faint p-2 pr-11">
        <PButton
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          :icon="Puzzle"
          @click="router.push(links.components())"
          >{{ t('components.allComponents') }}</PButton
        >
      </div>
    </template>
    <template #left-rail>
      <PButton
        variant="ghost"
        size="sm"
        square
        :icon="Plus"
        :label="t('components.new')"
        @click="emit('create', 'code')"
      />
    </template>

    <PEmptyState
      v-if="!component"
      class="m-auto"
      :icon="Puzzle"
      :title="t('components.notFound')"
      :description="t('components.notFoundLead')"
    >
      <PButton variant="ink" @click="router.push(links.components())">{{
        t('components.allComponents')
      }}</PButton>
    </PEmptyState>

    <template v-else>
      <!-- header -->
      <header
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-2 bg-surface px-4 py-2.5"
      >
        <div class="grid size-9 shrink-0 place-items-center rounded-[9px] bg-primary-tint text-primary">
          <Puzzle :size="18" />
        </div>
        <div class="min-w-0 flex-[1_1_240px]">
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="m-0 min-w-[60px] truncate text-[16px] font-extrabold tracking-[-0.01em]">
              {{ component.name }}
            </h1>
            <span
              class="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold"
              :class="component.source.type === 'ai' ? 'bg-purple-bg text-purple' : 'bg-teal-bg text-teal'"
              :title="component.source.prompt ?? t(`components.source.${component.source.type}`)"
            >
              <component :is="component.source.type === 'ai' ? Sparkles : CodeXml" :size="12" /><span
                class="max-xl:hidden"
                >{{ t(`components.source.${component.source.type}`) }}</span
              >
            </span>
            <StatusChip class="shrink-0" :status="status" />
          </div>
          <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-faint">
            <span class="truncate font-mono">{{ component.file }}</span>
            <span class="shrink-0">·</span>
            <span class="shrink-0">{{ t('components.props', component.props.length) }}</span>
            <span class="shrink-0">·</span>
            <span class="truncate font-mono">{{
              events.length ? t('components.events', { list: events.join(', ') }) : t('components.noEvents')
            }}</span>
          </div>
        </div>
        <div v-if="mode !== 'probing'" class="flex shrink-0 items-center">
          <PTooltip v-if="mode === 'builtin'" :text="t('components.frame.builtinHint', { origin })">
            <button
              type="button"
              class="flex h-6 items-center gap-1 rounded-md border border-line px-2 text-xs font-semibold text-fg-2 hover:bg-hover"
              :aria-label="t('components.frame.retry')"
              @click="retryConstructor"
            >
              {{ t('components.frame.builtin') }}<RefreshCw :size="11" />
            </button>
          </PTooltip>
          <span v-else class="flex h-6 items-center rounded-md bg-ok-bg px-2 text-xs font-semibold text-ok">{{
            t('components.frame.embedded')
          }}</span>
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <PButton
            v-if="status === 'needs_review'"
            variant="ink"
            size="sm"
            :icon="Check"
            @click="markReviewed"
            >{{ t('components.markReviewed') }}</PButton
          >
          <template v-if="mode === 'embedded'">
            <PSegmented
              v-model="viewport"
              size="sm"
              :options="viewportOptions"
              :aria-label="t('components.preview')"
            />
            <div v-if="embeddedDirty" class="flex items-center gap-2">
              <span class="text-sm font-semibold text-warn">{{ t('components.frame.dirty') }}</span>
              <PButton size="xs" variant="primary" @click="frame?.command('save')">{{
                t('components.frame.save')
              }}</PButton>
            </div>
          </template>
          <SaveBar
            v-else-if="saved !== null"
            :dirty="dirty"
            :saving="saving"
            @save="save()"
            @discard="discard"
          />
        </div>
      </header>

      <!-- banners -->
      <div
        v-if="job"
        class="flex shrink-0 flex-col gap-2 border-b border-primary-ring/50 bg-primary-tint/50 px-4 py-3"
      >
        <div class="flex items-start gap-2 text-sm leading-snug text-fg-2">
          <Sparkles :size="14" class="mt-0.5 shrink-0 text-purple" />
          <span
            ><b class="text-fg">{{ t('components.gen.title') }}</b> “{{ job.prompt }}”</span
          >
        </div>
        <ol class="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-1.5 p-0 pl-[22px]">
          <li
            v-for="s in genSteps"
            :key="s.label"
            class="flex items-center gap-1.5 text-sm font-semibold"
            :class="s.state === 'todo' ? 'text-faint' : 'text-fg'"
          >
            <CircleCheck v-if="s.state === 'done'" :size="14" class="text-ok" />
            <LoaderCircle v-else-if="s.state === 'on'" :size="14" class="animate-spin text-primary" />
            <Circle v-else :size="14" class="text-faint-2" />
            {{ s.label }}
          </li>
        </ol>
      </div>
      <div
        v-else-if="component.status === 'building'"
        class="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-warn/30 bg-warn-bg px-4 py-2.5 text-sm text-warn"
      >
        <TriangleAlert :size="14" class="shrink-0" /><span class="min-w-0 flex-1">{{
          t('components.gen.interrupted')
        }}</span>
        <PButton size="xs" @click="resumeReview(component)">{{ t('components.markReviewed') }}</PButton>
      </div>
      <div
        v-else-if="component.status === 'needs_review'"
        class="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-purple/20 bg-purple-bg px-4 py-2.5"
      >
        <Sparkles :size="15" class="shrink-0 text-purple" />
        <p class="m-0 min-w-0 flex-[1_1_220px] text-pretty text-sm leading-snug text-fg-2">
          {{
            component.source.type === 'ai'
              ? t('components.reviewAi', { name: component.name, n: component.props.length })
              : t('components.reviewCode', { name: component.name })
          }}
        </p>
      </div>
      <div
        v-if="versionMismatch"
        class="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-danger/30 bg-danger-bg px-4 py-2.5 text-sm text-danger"
      >
        <TriangleAlert :size="14" class="shrink-0" /><span class="min-w-0 flex-1">{{
          t('components.frame.version', versionMismatch)
        }}</span>
        <PButton size="xs" @click="useBuiltin">{{ t('components.frame.useBuiltin') }}</PButton>
      </div>

      <!-- embedded constructor -->
      <ConstructorFrame
        v-if="mode !== 'builtin'"
        :key="`${projectId}:${componentId}`"
        ref="frame"
        :project-id="projectId"
        :component-id="shortId(component.id)"
        :component-name="component.name"
        :theme="session.resolvedTheme"
        :locale="session.studioLanguage"
        :studio-role="session.user?.role ?? 'viewer'"
        :values="samples.values.value"
        :viewport-width="VIEWPORTS[viewport].px"
        @ready="mode = 'embedded'"
        @unavailable="useBuiltin"
        @version-mismatch="(got, want) => (versionMismatch = { got, want })"
        @status="embeddedStatus = $event"
        @dirty="embeddedDirty = $event"
        @meta="onGuestMeta"
        @error="(code, msg) => toast(t('components.frame.error', { msg }), { tone: 'danger' })"
        @navigate="onGuestNavigate"
      />

      <!-- built-in editor -->
      <div v-else-if="fileMissing" class="grid flex-1 place-items-center">
        <PEmptyState
          :icon="FileCode2"
          :title="t('components.fileMissing', { file: component.file })"
          :description="t('components.fileMissingLead')"
        >
          <PButton variant="primary" :icon="FilePlus2" @click="createMissingFile">{{
            t('components.createFile')
          }}</PButton>
        </PEmptyState>
      </div>
      <div
        v-else
        ref="splitEl"
        class="flex min-h-0 min-w-0 flex-1 overflow-hidden"
        :class="stacked ? 'flex-col' : 'flex-row'"
      >
        <section
          class="flex min-h-[160px] min-w-0 flex-1 flex-col overflow-hidden bg-code-bg"
          :class="!stacked && 'min-w-[260px]'"
        >
          <div
            class="flex h-[38px] shrink-0 items-end gap-0.5 border-b border-code-line bg-code-bg-2 px-2"
            role="tablist"
          >
            <button
              v-for="tab in [
                { k: 'code' as const, label: `${component.name}.vue`, icon: FileCode2 },
                { k: 'meta' as const, label: t('components.tabs.meta'), icon: Braces },
              ]"
              :key="tab.k"
              type="button"
              role="tab"
              :aria-selected="centreTab === tab.k"
              class="flex h-8 min-w-0 items-center gap-1.5 truncate rounded-t-[7px] px-3 font-mono text-xs"
              :class="centreTab === tab.k ? 'bg-code-bg text-code-fg' : 'text-code-muted hover:text-code-fg'"
              @click="centreTab = tab.k"
            >
              <component :is="tab.icon" :size="13" class="shrink-0 text-primary-ring" />{{ tab.label }}
            </button>
            <button
              type="button"
              class="mb-[5px] ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold"
              :class="previewOn ? 'bg-code-line text-code-fg' : 'text-code-muted hover:text-code-fg'"
              :title="t('components.previewToggle')"
              :aria-pressed="previewOn"
              @click="previewOn = !previewOn"
            >
              <component :is="previewOn ? Eye : EyeOff" :size="13" />{{ t('components.tabs.preview') }}
            </button>
          </div>

          <template v-if="centreTab === 'code'">
            <div v-if="saved === null && !job" class="grid flex-1 place-items-center text-code-muted">
              <PSpinner :size="18" />
            </div>
            <PCodeEditor
              v-else-if="job"
              :key="`gen:${component.id}`"
              class="min-h-0 flex-1"
              :model-value="shownSource"
              language="xml"
              readonly
            />
            <PCodeEditor
              v-else
              :key="component.file"
              v-model="draft"
              class="min-h-0 flex-1"
              language="xml"
              :path="`sandbox/${projectId}/${component.file}`"
              @save="save()"
            />
            <div
              v-if="sync?.kind === 'ok'"
              class="flex h-[34px] shrink-0 items-center gap-2 border-t border-code-line bg-code-bg-2 px-3.5 text-xs text-code-muted"
            >
              <span class="size-2.5 shrink-0 rounded-[3px] bg-primary/60" />
              {{ t('components.sync.ok', { n: t('components.props', component.props.length) }) }}
              <Check :size="13" class="text-ok-dot" />
            </div>
            <div
              v-else-if="sync"
              class="flex min-h-[34px] shrink-0 flex-wrap items-center gap-2 border-t border-warn/40 bg-code-bg-2 px-3.5 py-1.5 text-xs text-warn-dot"
              role="status"
            >
              <TriangleAlert :size="13" class="shrink-0" />
              <span class="min-w-[160px] flex-1">
                {{
                  sync.kind === 'missing'
                    ? t('components.sync.missing')
                    : sync.kind === 'codeOnly'
                      ? t('components.sync.codeOnly', { list: sync.names.join(', ') }, sync.names.length)
                      : t('components.sync.differs')
                }}
              </span>
              <button
                v-if="sync.kind === 'codeOnly'"
                type="button"
                class="h-[26px] rounded-md border border-warn/40 px-2.5 font-semibold hover:bg-warn/10"
                @click="importFromCode"
              >
                {{ t('components.sync.import', { list: sync.names.join(', ') }) }}
              </button>
              <PButton v-if="sync.kind !== 'missing'" size="xs" variant="primary" @click="rewriteFromProps">{{
                t('components.sync.rewrite')
              }}</PButton>
            </div>
          </template>
          <div v-else class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 scroll-thin">
            <div class="flex items-center gap-2.5">
              <span class="min-w-0 flex-1 font-mono text-xs text-code-muted">{{
                t('components.metaHint')
              }}</span>
              <button
                type="button"
                class="flex h-[26px] shrink-0 items-center gap-1.5 rounded-md border border-code-line bg-code-line px-2.5 text-xs font-semibold text-code-fg hover:bg-code-sel"
                @click="copyMeta"
              >
                <Copy :size="12" />{{ t('components.copy') }}
              </button>
            </div>
            <JsonView :value="meta" :copyable="false" />
          </div>
        </section>

        <section
          v-if="previewOn"
          class="flex min-h-[200px] min-w-0 flex-col overflow-hidden border-line-2 bg-bg"
          :class="stacked ? 'flex-1 border-t' : 'w-[44%] min-w-[280px] border-l'"
        >
          <div class="flex h-[38px] shrink-0 items-center gap-2 border-b border-line-2 bg-surface pl-3 pr-2">
            <span class="text-sm font-bold">{{ t('components.preview') }}</span>
            <StatusChip :status="status" size="xs" />
            <PSegmented
              v-model="viewport"
              class="ml-auto"
              size="sm"
              :options="viewportOptions"
              :aria-label="t('components.preview')"
            />
          </div>
          <div class="min-h-0 flex-1 overflow-auto bg-dots px-[18px] py-[22px] scroll-thin">
            <div class="mx-auto flex flex-col gap-2" :style="{ maxWidth: VIEWPORTS[viewport].w }">
              <div class="font-mono text-2xs text-faint">{{ t(`components.viewport.${viewport}`) }}</div>
              <CustomComponentPreview
                :component="component"
                :values="samples.values.value"
                :building="building"
                @update:value="samples.set"
              />
            </div>
          </div>
          <div
            class="flex shrink-0 flex-wrap items-center gap-2 border-t border-line-2 bg-surface px-3 py-2.5"
          >
            <PButton size="sm" :icon="SlidersHorizontal" @click="rightTab = 'inputs'">{{
              t('components.sampleValues')
            }}</PButton>
            <PButton
              class="ml-auto"
              size="sm"
              variant="primary"
              :icon="Plus"
              :disabled="building"
              @click="addToPage"
            >
              {{ targetPage ? t('components.addTo', { page: targetPage.name }) : t('components.addToPage') }}
            </PButton>
          </div>
        </section>
      </div>
    </template>

    <template #right>
      <template v-if="component">
        <div class="flex shrink-0 flex-col gap-2 border-b border-line-faint px-3 pb-2.5 pt-3">
          <PSegmented
            v-model="rightTab"
            block
            :options="[
              { value: 'props', label: t('components.right.props') },
              { value: 'inputs', label: t('components.right.inputs') },
            ]"
          />
          <p class="m-0 text-pretty px-0.5 text-xs leading-snug text-faint">
            {{
              rightTab === 'props'
                ? t('components.right.propsHint')
                : t('components.right.inputsHint', { name: component.name })
            }}
          </p>
        </div>
        <PropsEditor
          v-if="rightTab === 'props'"
          :component="component"
          :readonly="building"
          @change="onPropsChange"
        />
        <InputsPanel v-else :component="component" :values="samples.values.value" @set="samples.set" />
      </template>
    </template>
  </LayerShell>
</template>
