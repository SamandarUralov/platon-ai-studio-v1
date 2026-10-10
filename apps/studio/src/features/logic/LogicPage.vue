<script setup lang="ts">
/**
 * Logic layer (requirements §3.3): functions, APIs, crons and message queues.
 * Route: logic/:kind?/:itemId?
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  insertStep,
  LOGIC_KINDS,
  makeStep,
  ROOT,
  STEPS,
  type LogicFunction,
  type LogicKind,
  type Queue,
  type Step,
  type StepType,
} from '@platon/definition'
import { PIcon, PSpinner, toast } from '@platon/ui'
import LayerShell from '@/components/shell/LayerShell.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useDraftsStore } from '@/stores/drafts'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useLogicStats } from './api'
import { useLogicEditor } from './store'
import { useLogicItem } from './composables/useLogicItem'
import { itemTitle, KIND_NOUN, newItem, stepsOf } from './lib/items'
import type { LogicItem } from './lib/nav'
import LogicNav from './components/nav/LogicNav.vue'
import LayerPalette from './components/nav/LayerPalette.vue'
import BuilderView from './components/builder/BuilderView.vue'
import QueueView from './components/queue/QueueView.vue'
import RightPanel from './components/RightPanel.vue'
import KindOverview from './components/KindOverview.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const def = useDefinitionStore()
const drafts = useDraftsStore()
const ed = useLogicEditor()
const pid = useProjectId()
const stats = useLogicStats(pid)

const KINDS = Object.keys(LOGIC_KINDS) as LogicKind[]
const kind = computed<LogicKind>(() => {
  const k = String(route.params.kind ?? '')
  return (KINDS as string[]).includes(k) ? (k as LogicKind) : 'functions'
})
const itemId = computed(() => String(route.params.itemId ?? ''))
const items = computed(() => (def.definition?.logic[kind.value] ?? []) as LogicItem[])
const exists = computed(() => !!itemId.value && items.value.some((x) => x.id === itemId.value))
const L = useLogicItem(kind, itemId)

// Unknown kind or a deleted item: fall back to the group overview.
watch(
  [() => route.params.kind, itemId, () => def.ready],
  () => {
    if (!def.ready) return
    if (route.params.kind && !(KINDS as string[]).includes(String(route.params.kind)))
      void router.replace(projectLinks(pid.value).logic('functions'))
    else if (itemId.value && !exists.value) void router.replace(projectLinks(pid.value).logic(kind.value))
  },
  { immediate: true },
)

function open(k: LogicKind, id: string) {
  void router.push(projectLinks(pid.value).logic(k, id))
}

function create(k: LogicKind, pkg?: string) {
  const d = def.definition
  if (!d) return
  const it = newItem(k, d, pkg)
  const ok = def.apply({
    key: `logic.${k}.${it.id}`,
    area: 'Logic',
    text: `Created ${KIND_NOUN[k]} “${itemTitle(k, it)}”`,
    ops: [{ op: 'add', path: `/logic/${k}/-`, value: it }],
  })
  if (ok) {
    if (pkg) ed.togglePkg(pkg, true)
    ed.openGroups = { ...ed.openGroups, [k]: true }
    ed.rightTab = 'layer'
    ed.apiTab = 'api'
    open(k, it.id)
  }
}

// ── palette double-click: add at the end of the method (before a final Return) ──
function addStep(type: StepType, config?: Record<string, string>) {
  const steps = stepsOf(L.item.value)
  const last = steps[steps.length - 1]
  const at = last?.type === 'return' ? steps.length - 1 : steps.length
  const step: Step = makeStep(type, config)
  L.editSteps((s) => insertStep(s, ROOT, at, step))
  ed.select(L.path.value, step.id)
  toast(t('logic.palette.added', { label: STEPS[type].label }))
}

function attachConsumer(f: LogicFunction) {
  const q = L.item.value as Queue | undefined
  if (!q || q.consumers.includes(f.name)) return
  L.edit((x) => ({ ...(x as Queue), consumers: [...(x as Queue).consumers, f.name] }))
}

const functions = computed(() => def.definition?.logic.functions ?? [])
const paletteMode = computed(() =>
  kind.value === 'functions' ? 'method' : kind.value === 'queues' ? 'consumers' : 'calls',
)
const currentFnName = computed(() =>
  kind.value === 'functions' && L.item.value ? (L.item.value as LogicFunction).name : undefined,
)
const dirtyCount = computed(() => drafts.dirtyPaths.filter((p) => p.startsWith('/logic/')).length)
</script>

<template>
  <div v-if="!def.ready" class="grid h-full place-items-center"><PSpinner /></div>
  <LayerShell v-else :has-right="exists">
    <template #left>
      <div class="flex min-h-0 flex-1 flex-col">
        <LogicNav
          :fill="!exists"
          :kind="kind"
          :active-id="exists ? itemId : null"
          :stats="stats.data.value"
          @open="open"
          @create="create"
        />
        <LayerPalette
          v-if="exists"
          :mode="paletteMode"
          :functions="functions"
          :exclude-fn="currentFnName"
          @add="addStep"
          @attach="attachConsumer"
        />
        <div
          v-if="dirtyCount"
          class="shrink-0 border-t border-line-faint px-3.5 py-2 pr-11 text-xs text-warn"
        >
          {{ t('logic.unsavedCount', dirtyCount) }}
        </div>
      </div>
    </template>
    <template #left-rail>
      <button
        v-for="k in KINDS"
        :key="k"
        type="button"
        class="grid size-8 place-items-center rounded-lg hover:bg-hover"
        :class="k === kind ? 'bg-primary-tint text-primary-strong' : 'text-muted'"
        :title="t(`logic.kinds.${k}`)"
        @click="router.push(projectLinks(pid).logic(k))"
      >
        <PIcon :name="LOGIC_KINDS[k].icon" :size="15" />
      </button>
    </template>

    <template v-if="exists">
      <QueueView v-if="kind === 'queues'" :key="`q:${itemId}`" :id="itemId" />
      <BuilderView v-else :key="`${kind}:${itemId}`" :kind="kind" :id="itemId" />
    </template>
    <KindOverview
      v-else
      :kind="kind"
      :stats="stats.data.value"
      @open="open(kind, $event)"
      @create="create(kind)"
    />

    <template #right="{ close }">
      <RightPanel v-if="exists" :kind="kind" :id="itemId" :close="close" />
    </template>
  </LayerShell>
</template>
