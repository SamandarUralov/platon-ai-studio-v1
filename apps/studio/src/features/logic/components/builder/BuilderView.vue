<script setup lang="ts">
/** Centre workspace for functions, APIs and crons: header, Builder / Flowchart / JSON views, test run. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Braces, Clock, FlaskConical, LayoutList, Pause, Play, Send, Workflow } from 'lucide-vue-next'
import {
  countSteps,
  formatType,
  LOGIC_KINDS,
  type Api,
  type Cron,
  type LogicFunction,
  type LogicKind,
  type Step,
  type TraceStep,
} from '@platon/definition'
import { cn, PBadge, PButton, PTabs, toast, toneClasses, type TabItem } from '@platon/ui'
import JsonView from '@/components/common/JsonView.vue'
import SaveBar from '@/components/common/SaveBar.vue'
import { useShortcuts } from '@/composables/useShortcuts'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { errorMessage } from '@/services/http'
import { useLogicItem } from '../../composables/useLogicItem'
import { useLogicEditor, type BuilderView } from '../../store'
import { useLogicStats, useTestRun } from '../../api'
import { accessLabel, apiLabel } from '../../lib/apis'
import { describeCron } from '../../lib/cron'
import { itemStatus, problemsByStep } from '../../lib/status'
import ToneTile from '../ToneTile.vue'
import StepTree from './StepTree.vue'
import Flowchart from './Flowchart.vue'
import TestRunPanel from './TestRunPanel.vue'

const props = defineProps<{ kind: Exclude<LogicKind, 'queues'>; id: string }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ed = useLogicEditor()
const pid = useProjectId()
const stats = useLogicStats(pid)
const L = useLogicItem<LogicFunction | Api | Cron>(
  () => props.kind,
  () => props.id,
)
const testRun = useTestRun(pid)

const item = L.item
const fn = computed(() => (props.kind === 'functions' ? (item.value as LogicFunction) : null))
const api = computed(() => (props.kind === 'apis' ? (item.value as Api) : null))
const cron = computed(() => (props.kind === 'crons' ? (item.value as Cron) : null))
const steps = computed<Step[]>(() => item.value?.steps ?? [])
const functions = computed(() => def.definition?.logic.functions ?? [])
const meta = computed(() => LOGIC_KINDS[props.kind])

const view = computed<BuilderView>({
  get: () => ed.view[L.path.value] ?? 'builder',
  set: (v) => (ed.view = { ...ed.view, [L.path.value]: v }),
})
const VIEWS = computed<TabItem<BuilderView>[]>(() => [
  { value: 'builder', label: t('logic.views.builder'), icon: LayoutList },
  { value: 'flow', label: t('logic.views.flow'), icon: Workflow },
  { value: 'json', label: t('logic.views.json'), icon: Braces },
])

const stepProblems = computed(() => problemsByStep(L.problems.value, L.path.value))
const status = computed(() =>
  item.value ? itemStatus(props.kind, item.value, L.problems.value, stats.data.value) : null,
)
const trace = computed(() => {
  const r = ed.tests[L.path.value]
  return r ? new Map<string, TraceStep>(r.res.trace.map((x) => [x.stepId, x])) : undefined
})

const title = computed(() => {
  if (fn.value) return fn.value.name
  if (cron.value) return cron.value.name
  return api.value ? apiLabel(api.value).text : ''
})
const sub = computed(() => {
  const n = t('logic.layers', countSteps(steps.value))
  if (fn.value)
    return [n, fn.value.timeout && t('logic.timeoutShort', { t: fn.value.timeout })]
      .filter(Boolean)
      .join(' · ')
  if (api.value) return [n, accessLabel(api.value)].join(' · ')
  if (cron.value)
    return [describeCron(cron.value.schedule) ?? cron.value.schedule, cron.value.timezone].join(' · ')
  return n
})
const description = computed(() =>
  fn.value ? fn.value.description : api.value ? api.value.description : undefined,
)

const testOpen = computed({
  get: () => !!ed.testOpen[L.path.value],
  set: (v) => (ed.testOpen = { ...ed.testOpen, [L.path.value]: v }),
})
const tester = ref<InstanceType<typeof TestRunPanel>>()
const tree = ref<InstanceType<typeof StepTree>>()

function onStepsChange(next: Step[]) {
  L.editSteps(() => next)
}

function openSettings() {
  ed.select(L.path.value, null)
  ed.rightTab = 'layer'
  ed.apiTab = 'api'
}

function togglePause() {
  const c = cron.value
  if (!c) return
  // Pausing is an operational switch, so it applies directly instead of waiting in the draft.
  const enabled = !c.enabled
  if (
    def.apply({
      key: `logic.crons.${c.id}.enabled`,
      area: 'Logic',
      text: `${enabled ? 'Resumed' : 'Paused'} cron “${c.name}”`,
      ops: [{ op: 'replace', path: `${L.path.value}/enabled`, value: enabled }],
    }) &&
    L.dirty.value
  )
    L.edit((x) => ({ ...x, enabled }))
}

async function runCron() {
  const c = cron.value
  if (!c) return
  try {
    const res = await testRun.mutateAsync({
      kind: 'crons',
      id: c.id,
      verb: 'run',
      req: { input: {}, item: c },
    })
    ed.setTest(L.path.value, { res, sig: JSON.stringify(c.steps) })
    toast(
      res.ok
        ? t('logic.cron.ranOk', { name: c.name, ms: res.ms })
        : t('logic.cron.ranFail', { name: c.name, msg: res.error?.message ?? '' }),
      { tone: res.ok ? 'ok' : 'danger' },
    )
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}

function sendTest() {
  ed.select(L.path.value, null)
  ed.rightTab = 'layer'
  ed.apiTab = 'test'
}

useShortcuts([
  { keys: 'mod+s', run: () => (L.dirty.value ? L.save() : false), inInputs: true },
  {
    keys: 'mod+enter',
    run: () => {
      if (props.kind === 'functions' && testOpen.value) void tester.value?.run()
      else if (props.kind === 'crons') void runCron()
      else return false
    },
    inInputs: true,
  },
  {
    keys: 'escape',
    run: () => {
      if (!ed.selected[L.path.value]) return false
      ed.select(L.path.value, null)
    },
  },
  {
    keys: 'delete',
    run: () => {
      const s = ed.selected[L.path.value]
      if (!s || view.value !== 'builder') return false
      tree.value?.remove(s)
    },
  },
  {
    keys: 'backspace',
    run: () => {
      const s = ed.selected[L.path.value]
      if (!s || view.value !== 'builder') return false
      tree.value?.remove(s)
    },
  },
])
</script>

<template>
  <div v-if="item" class="flex min-h-0 flex-1 flex-col">
    <!-- header -->
    <header class="shrink-0 border-b border-line-2 bg-surface px-6 pt-4">
      <div class="flex items-start gap-3.5">
        <ToneTile :icon="kind === 'crons' ? 'clock' : meta.icon" :tone="meta.tone" size="lg" />
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <span
              v-if="api"
              :class="
                cn(
                  'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs font-bold',
                  toneClasses[apiLabel(api).tone].bg,
                  toneClasses[apiLabel(api).tone].fg,
                )
              "
              >{{ apiLabel(api).badge }}</span
            >
            <h1
              class="-mx-1 cursor-pointer truncate rounded-md px-1 text-[22px] font-extrabold leading-8 tracking-tight hover:bg-primary-tint hover:text-primary-strong"
              :class="kind !== 'crons' && 'font-mono'"
              :title="t('logic.showSettings')"
              @click="openSettings"
            >
              {{ title }}
            </h1>
          </div>
          <div class="truncate text-sm text-muted">
            {{ sub }} · <span class="font-mono">logic.{{ kind }}.{{ id }}</span>
          </div>
          <p v-if="description" class="mt-0.5 line-clamp-1 text-sm text-fg-2">{{ description }}</p>
          <button
            v-else-if="kind === 'functions'"
            type="button"
            class="mt-0.5 text-sm text-faint hover:text-primary-strong"
            @click="openSettings"
          >
            {{ t('logic.addDescription') }}
          </button>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <SaveBar :dirty="L.dirty.value" @save="L.save" @discard="L.discard" />
          <PBadge v-if="status" :tone="status.tone">{{
            t(`logic.status.${status.key}`, { n: status.count ?? 0 })
          }}</PBadge>
          <template v-if="cron">
            <PButton :icon="cron.enabled ? Pause : Play" @click="togglePause">{{
              cron.enabled ? t('logic.cron.pause') : t('logic.cron.resume')
            }}</PButton>
            <PButton variant="ink" :icon="Clock" :loading="testRun.isPending.value" @click="runCron">{{
              t('logic.cron.runNow')
            }}</PButton>
          </template>
          <PButton v-if="api" :icon="Send" @click="sendTest">{{ t('logic.api.sendTest') }}</PButton>
          <PButton
            v-if="fn"
            :variant="testOpen ? 'ink' : 'outline'"
            :icon="FlaskConical"
            @click="((testOpen = !testOpen), (view = 'builder'))"
            >{{ t('logic.test.title') }}</PButton
          >
        </div>
      </div>
      <PTabs v-model="view" :items="VIEWS" class="mt-3 border-b-0" />
    </header>

    <!-- builder -->
    <div
      v-if="view === 'builder'"
      class="min-h-0 flex-1 overflow-auto scroll-thin"
      @click.self="openSettings"
    >
      <div class="mx-auto flex max-w-[900px] flex-col gap-3 px-6 py-5" @click.self="openSettings">
        <TestRunPanel
          v-if="fn && testOpen"
          ref="tester"
          :path="L.path.value"
          :id="id"
          :fn="fn"
          @close="testOpen = false"
        />
        <div class="flex">
          <span
            class="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-on-ink"
          >
            <Play v-if="!cron" :size="13" />
            <Clock v-else :size="13" />
            <template v-if="fn"
              >{{ t('logic.start')
              }}<span class="truncate font-mono font-medium opacity-70">{{
                fn.params.map((p) => `${p.name}: ${formatType(p.type, p.fields)}`).join(', ')
              }}</span></template
            >
            <template v-else-if="api"
              >{{ apiLabel(api).badge
              }}<span class="truncate font-mono font-medium opacity-70">{{
                apiLabel(api).text
              }}</span></template
            >
            <template v-else-if="cron"
              >{{ cron.enabled ? t('logic.cron.on') : t('logic.cron.paused')
              }}<span class="truncate font-mono font-medium opacity-70"
                >{{ cron.schedule }} · {{ cron.timezone }}</span
              ></template
            >
          </span>
        </div>
        <StepTree
          ref="tree"
          :steps="steps"
          :path="L.path.value"
          :mode="kind === 'functions' ? 'method' : 'calls'"
          :functions="functions"
          :problems="stepProblems"
          :trace="trace"
          :allow-return="kind === 'apis'"
          @change="onStepsChange"
        />
        <div v-if="fn && fn.returns.type !== 'void'" class="flex">
          <span
            class="inline-flex max-w-full items-center gap-2 truncate rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-bold text-fg-2"
          >
            {{ t('logic.returns')
            }}<span class="truncate font-mono font-medium text-muted">{{
              formatType(fn.returns.type, fn.returns.fields)
            }}</span>
          </span>
        </div>
      </div>
    </div>

    <Flowchart
      v-else-if="view === 'flow'"
      :steps="steps"
      :selected="ed.selected[L.path.value] ?? null"
      :problems="stepProblems"
      @select="ed.select(L.path.value, $event)"
    />

    <div v-else class="min-h-0 flex-1 overflow-auto p-6 scroll-thin">
      <div class="mx-auto max-w-[900px]">
        <div class="mb-2 flex items-baseline gap-2">
          <span class="font-mono text-sm font-semibold">{{ id }}.json</span>
          <span class="text-xs text-faint">{{ t('logic.jsonHint') }}</span>
        </div>
        <JsonView :value="item" max-height="calc(100vh - 280px)" />
      </div>
    </div>
  </div>
</template>
