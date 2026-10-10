<script setup lang="ts">
/** Code mode: the page file in Monaco (draft + ⌘S), Problems and the Preview console. */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type * as Monaco from 'monaco-editor'
import { ChevronDown, CircleCheck, FileCode, Play, TriangleAlert } from 'lucide-vue-next'
import { PButton, PCodeEditor } from '@platon/ui'
import type { Page, Problem } from '@platon/definition'
import { scriptProblems } from '@platon/validators'
import { useScriptLogs } from '@platon/renderer'
import ProblemsList from '@/components/common/ProblemsList.vue'
import SaveBar from '@/components/common/SaveBar.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useShortcuts } from '@/composables/useShortcuts'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceStore } from '../store'
import { ctxTypings } from '../lib/script'
import { setCtxLib, setProblemMarkers } from './monaco'
import { usePageScript } from './usePageScript'

const props = defineProps<{ page: Page }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ui = useInterfaceStore()
const router = useRouter()
const pid = useProjectId()
const script = usePageScript(() => props.page)
const logs = useScriptLogs()

const code = computed({ get: () => script.source.value, set: (v: string) => script.edit(v) })
const lines = computed(() => code.value.split('\n').length)
const cursor = ref({ line: 1, col: 1 })

// problems: validators + Monaco's own syntax diagnostics
const ownProblems = computed<Problem[]>(() =>
  def.definition ? scriptProblems(props.page, code.value, def.definition, script.path.value) : [],
)
const syntax = shallowRef<Problem[]>([])
const problems = computed(() => [...syntax.value, ...ownProblems.value])
const errors = computed(() => problems.value.filter((p) => p.severity === 'error').length)

let markersSub: Monaco.IDisposable | null = null
onBeforeUnmount(() => markersSub?.dispose())
const ed = shallowRef<{ editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco } | null>(null)
function onReady(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
  ed.value = { editor, monaco }
  markersSub?.dispose()
  markersSub = monaco.editor.onDidChangeMarkers((uris) => {
    const model = editor.getModel()
    if (!model || !uris.some((u) => u.toString() === model.uri.toString())) return
    syntax.value = monaco.editor
      .getModelMarkers({ resource: model.uri })
      .filter((m) => m.owner !== 'platon' && m.severity === monaco.MarkerSeverity.Error)
      .map((m) => ({
        severity: 'error',
        code: 'syntax',
        message: m.message,
        path: script.path.value,
        line: m.startLineNumber,
        column: m.startColumn,
      }))
  })
  handleRequest()
}
watch(
  [() => (def.definition ? ctxTypings(props.page, def.definition) : ''), ed],
  ([lib]) => ed.value && lib && setCtxLib(ed.value.monaco, lib),
  { immediate: true },
)
watch(
  [ownProblems, ed],
  () => ed.value && setProblemMarkers(ed.value.monaco, ed.value.editor.getModel(), ownProblems.value),
)

function goLine(line: number) {
  const e = ed.value?.editor
  if (!e) return
  e.revealLineInCenter(line)
  e.setPosition({ lineNumber: line, column: e.getModel()?.getLineFirstNonWhitespaceColumn(line) || 1 })
  e.focus()
}
function handleRequest() {
  const r = ui.codeRequest
  const e = ed.value?.editor
  if (!r || !e) return
  ui.codeRequest = null
  if (r.line) goLine(r.line)
  if (r.insert) {
    const sel = e.getSelection()
    if (sel) e.executeEdits('platon', [{ range: sel, text: r.insert, forceMoveMarkers: true }])
    e.focus()
  }
}
watch(() => ui.codeRequest, handleRequest)

function save() {
  if (errors.value && !window.confirm(t('interface.code.saveWithErrors', { n: errors.value }))) return
  script.save()
}
useShortcuts([{ keys: 'mod+s', run: () => (script.dirty.value ? save() : false), inInputs: true }])

// bottom panel
const tab = ref<'problems' | 'console'>('problems')
const panelOpen = ref(true)
const pageLogs = computed(() => logs.entries.value.filter((l) => l.pageId === props.page.id))
const tabs = computed(() => [
  {
    value: 'problems' as const,
    label: t('interface.code.problems'),
    count: problems.value.length || undefined,
    tone: errors.value ? ('danger' as const) : undefined,
  },
  {
    value: 'console' as const,
    label: t('interface.code.console'),
    count: pageLogs.value.length || undefined,
  },
])
const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const LVL: Record<string, string> = {
  error: 'text-danger-dot',
  warn: 'text-warn-dot',
  info: 'text-info',
  log: 'text-code-muted',
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-code-bg text-code-fg">
    <div class="flex h-11 shrink-0 items-center gap-2.5 border-b border-code-line px-3.5">
      <FileCode :size="15" class="text-code-muted" />
      <span class="font-mono text-sm">{{ script.file.value }}</span>
      <span class="text-xs text-code-muted">{{
        t('interface.code.meta', { n: lines, line: cursor.line, col: cursor.col })
      }}</span>
      <span
        v-if="!script.exists.value"
        class="rounded-md bg-code-line px-1.5 py-0.5 text-2xs font-semibold text-code-muted"
        >{{ t('interface.code.generated') }}</span
      >
      <div class="ml-auto [&_.text-faint]:text-code-muted">
        <SaveBar :dirty="script.dirty.value" @save="save" @discard="script.discard()" />
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <PCodeEditor
        v-model="code"
        :path="script.file.value"
        language="javascript"
        @ready="onReady"
        @save="save"
        @cursor="(l, c) => (cursor = { line: l, col: c })"
      />
    </div>
    <div class="shrink-0 border-t border-code-line">
      <div class="flex h-10 items-center gap-2 px-2.5">
        <div class="flex gap-1">
          <button
            v-for="x in tabs"
            :key="x.value"
            type="button"
            class="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold"
            :class="
              tab === x.value && panelOpen
                ? 'bg-code-line text-code-fg'
                : 'text-code-muted hover:text-code-fg'
            "
            @click="((tab = x.value), (panelOpen = true))"
          >
            {{ x.label }}
            <span
              v-if="x.count"
              class="rounded-full px-1.5 text-2xs font-bold"
              :class="x.tone === 'danger' ? 'bg-danger-dot text-white' : 'bg-code-sel text-code-fg'"
              >{{ x.count }}</span
            >
          </button>
        </div>
        <span v-if="!errors" class="flex items-center gap-1 text-xs text-ok-dot"
          ><CircleCheck :size="13" />{{ t('interface.code.ready') }}</span
        >
        <span v-else class="flex items-center gap-1 text-xs text-danger-dot"
          ><TriangleAlert :size="13" />{{ t('interface.code.blocking', { n: errors }, errors) }}</span
        >
        <div class="ml-auto flex items-center gap-1.5">
          <button
            v-if="tab === 'console' && pageLogs.length"
            type="button"
            class="h-7 rounded-md px-2 text-xs font-semibold text-code-muted hover:text-code-fg"
            @click="logs.clear(page.id)"
          >
            {{ t('interface.code.clear') }}
          </button>
          <PButton
            size="xs"
            variant="ghost"
            :icon="Play"
            class="text-code-fg hover:bg-code-line"
            @click="router.push(projectLinks(pid).preview(page.id))"
            >{{ t('interface.code.run') }}</PButton
          >
          <button
            type="button"
            class="grid size-7 place-items-center rounded-md text-code-muted hover:text-code-fg"
            :aria-label="t('interface.code.togglePanel')"
            @click="panelOpen = !panelOpen"
          >
            <ChevronDown :size="14" :class="panelOpen ? '' : 'rotate-180'" />
          </button>
        </div>
      </div>
      <div v-if="panelOpen" class="h-44 overflow-y-auto scroll-thin">
        <ProblemsList
          v-if="tab === 'problems'"
          :problems="problems"
          dark
          :empty-text="t('interface.code.noProblems')"
          @select="(p) => p.line && goLine(p.line)"
        />
        <template v-else>
          <p v-if="!pageLogs.length" class="px-3.5 py-3 text-sm text-code-muted">
            {{ t('interface.code.noLog') }}
          </p>
          <div
            v-for="l in pageLogs"
            :key="l.id"
            class="flex gap-3 border-b border-code-line/60 px-3.5 py-1 font-mono text-xs"
          >
            <span class="shrink-0 text-code-muted">{{ time(l.at) }}</span>
            <span class="w-10 shrink-0 uppercase" :class="LVL[l.level]">{{ l.level }}</span>
            <span
              class="min-w-0 flex-1 break-words whitespace-pre-wrap"
              :class="l.level === 'error' ? 'text-danger-dot' : ''"
              >{{ l.text }}</span
            >
            <span v-if="l.src || l.role" class="shrink-0 text-code-muted">{{
              [l.src, l.role].filter(Boolean).join(' · ')
            }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
