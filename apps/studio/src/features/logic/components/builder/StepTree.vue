<script setup lang="ts">
/**
 * Layer tree editor (requirements §3.3): branches, drop gaps, + picker, drag to reorder or add,
 * up/down, duplicate, delete. Rendered as flat rows so 300 layers stay smooth.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import {
  cloneStep,
  findStep,
  insertStep,
  locateStep,
  makeStep,
  moveStep,
  removeStep,
  STEPS,
  type LogicFunction,
  type Step,
  type TraceStep,
} from '@platon/definition'
import { cn, PPopover, toneClasses } from '@platon/ui'
import { useLogicEditor } from '../../store'
import { flattenSteps, type BuilderRow } from '../../lib/rows'
import { defaultArgs } from '../../lib/infer'
import StepCard from './StepCard.vue'
import StepPicker, { type PickedStep } from './StepPicker.vue'

const props = defineProps<{
  steps: Step[]
  /** Item path — keys selection and collapsed state. */
  path: string
  mode: 'method' | 'calls'
  functions: LogicFunction[]
  problems: Map<string, string>
  trace?: Map<string, TraceStep>
  allowReturn?: boolean
}>()
const emit = defineEmits<{ change: [steps: Step[], text: string] }>()
const { t } = useI18n()
const ed = useLogicEditor()

const collapsed = computed(() => new Set(ed.collapsed[props.path] ?? []))
const rows = computed(() => flattenSteps(props.steps, collapsed.value))
const selectedId = computed(() => ed.selected[props.path] ?? null)
const dragging = computed(
  () => !!ed.drag && ed.drag.kind !== 'pkg' && (ed.drag.kind !== 'item' || ed.drag.itemKind === 'functions'),
)
const over = ref<string | null>(null)

// ── edits ──
function commit(next: Step[], text: string, select?: string) {
  emit('change', next, text)
  if (select) ed.select(props.path, select)
}

function stepFromPick(p: PickedStep): Step {
  return makeStep(p.type, p.config)
}

function insertAt(branchId: string, index: number, step: Step) {
  commit(insertStep(props.steps, branchId, index, step), `Added ${STEPS[step.type].label} layer`, step.id)
}

function remove(id: string) {
  const s = findStep(props.steps, id)
  if (!s || s.type === 'return') return
  commit(removeStep(props.steps, id), `Deleted ${STEPS[s.type].label} layer`)
  if (selectedId.value === id) ed.select(props.path, null)
}

function duplicate(id: string) {
  const s = findStep(props.steps, id)
  const at = locateStep(props.steps, id)
  if (!s || !at || s.type === 'return') return
  const copy = cloneStep(s)
  commit(
    insertStep(props.steps, at.branchId, at.index + 1, copy),
    `Duplicated ${STEPS[s.type].label} layer`,
    copy.id,
  )
}

function shift(id: string, by: -1 | 1) {
  const at = locateStep(props.steps, id)
  if (!at) return
  const to = at.index + by
  if (to < 0 || to >= at.length) return
  // moveStep inserts before `index` in the list without the moved step.
  commit(moveStep(props.steps, id, at.branchId, by > 0 ? to + 1 : to), 'Moved a layer')
}

defineExpose({ remove, duplicate, shift })

// ── drag & drop ──
function onDragStart(e: DragEvent, id: string) {
  ed.drag = { kind: 'move', stepId: id }
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  ed.drag = null
  over.value = null
}
function onOver(e: DragEvent, key: string) {
  if (!dragging.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = ed.drag?.kind === 'move' ? 'move' : 'copy'
  over.value = key
}
function onDrop(e: DragEvent, branchId: string, index: number) {
  e.preventDefault()
  const d = ed.drag
  onDragEnd()
  if (!d) return
  if (d.kind === 'move') {
    const next = moveStep(props.steps, d.stepId, branchId, index)
    if (next !== props.steps) commit(next, 'Moved a layer', d.stepId)
  } else if (d.kind === 'new') insertAt(branchId, index, makeStep(d.type, d.config))
  else if (d.kind === 'item' && d.itemKind === 'functions') {
    const f = props.functions.find((x) => x.id === d.id)
    if (f) insertAt(branchId, index, makeStep('call', { fn: f.name, args: defaultArgs(f), into: 'result' }))
  }
}

// ── picker ──
const wrap = ref<HTMLElement>()
const pick = ref<{ branchId: string; index: number; top: number; left: number } | null>(null)
const pickOpen = computed({
  get: () => !!pick.value,
  set: (v) => {
    if (!v) pick.value = null
  },
})
function openPicker(e: MouseEvent, branchId: string, index: number) {
  const el = e.currentTarget as HTMLElement
  const box = wrap.value!.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  pick.value = {
    branchId,
    index,
    top: r.top - box.top + r.height / 2,
    left: Math.min(r.left - box.left + r.width / 2, box.width - 20),
  }
}
function onPick(p: PickedStep) {
  const at = pick.value
  pick.value = null
  if (at) insertAt(at.branchId, at.index, stepFromPick(p))
}

const BR_TONE = (type: Step['type']) => toneClasses[STEPS[type].tone]
const sig = (s: Step) => `${JSON.stringify(s.config)}|${s.note ?? ''}|${s.branches?.length ?? 0}`
const isPick = (branchId: string, index: number) =>
  !!pick.value && pick.value.branchId === branchId && pick.value.index === index

/** Rows re-render only when what they show changes — keeps edits cheap with hundreds of layers. */
function memo(row: BuilderRow): unknown[] {
  if (row.k === 'step')
    return [
      row.k,
      sig(row.step),
      selectedId.value === row.step.id,
      props.problems.get(row.step.id),
      props.trace?.get(row.step.id),
      row.collapsed,
      row.index,
      row.length,
      row.depth,
    ]
  if (row.k === 'branch') return [row.k, row.label, row.depth, row.parentType]
  return [
    row.k,
    dragging.value,
    over.value === row.key,
    isPick(row.branchId, row.index),
    row.depth,
    props.mode,
  ]
}
</script>

<template>
  <div ref="wrap" class="relative">
    <div v-for="row in rows" :key="row.key" v-memo="memo(row)">
      <!-- gap between layers: hover shows +, while dragging it becomes a drop zone -->
      <div
        v-if="row.k === 'gap'"
        class="flex"
        @dragover="onOver($event, row.key)"
        @dragleave="over === row.key && (over = null)"
        @drop="onDrop($event, row.branchId, row.index)"
      >
        <div v-for="d in row.depth" :key="d" class="flex w-6 shrink-0 justify-center">
          <div class="w-px bg-line" />
        </div>
        <div
          v-if="dragging"
          :class="
            cn(
              'my-1 grid h-8 flex-1 place-items-center rounded-lg border-[1.5px] border-dashed text-xs font-semibold',
              over === row.key
                ? 'border-primary bg-primary-tint text-primary-strong'
                : 'border-line text-faint',
            )
          "
        >
          {{ t('logic.builder.dropHere') }}
        </div>
        <button
          v-else
          type="button"
          class="group/gap relative flex h-3 flex-1 items-center justify-center"
          :title="t('logic.builder.addHere')"
          @click="openPicker($event, row.branchId, row.index)"
        >
          <span
            class="absolute inset-x-0 top-1/2 h-px bg-primary opacity-0 transition-opacity group-hover/gap:opacity-60 group-focus-visible/gap:opacity-60"
          />
          <span
            class="relative grid size-[18px] place-items-center rounded-full border border-primary bg-surface text-primary opacity-0 transition-opacity group-hover/gap:opacity-100 group-focus-visible/gap:opacity-100"
            ><Plus :size="12"
          /></span>
        </button>
      </div>

      <div v-else-if="row.k === 'step'" class="flex">
        <div v-for="d in row.depth" :key="d" class="flex w-6 shrink-0 justify-center">
          <div class="w-px bg-line" />
        </div>
        <StepCard
          class="min-w-0 flex-1"
          :step="row.step"
          :selected="selectedId === row.step.id"
          :problem="problems.get(row.step.id)"
          :trace="trace?.get(row.step.id)"
          :collapsed="row.collapsed"
          :can-up="row.index > 0"
          :can-down="row.index < row.length - 1"
          :locked="row.step.type === 'return'"
          :data-step="row.step.id"
          @select="ed.select(path, row.step.id)"
          @remove="remove(row.step.id)"
          @duplicate="duplicate(row.step.id)"
          @up="shift(row.step.id, -1)"
          @down="shift(row.step.id, 1)"
          @toggle="ed.toggleCollapsed(path, row.step.id)"
          @dragstart="onDragStart($event, row.step.id)"
          @dragend="onDragEnd"
        />
      </div>

      <div v-else-if="row.k === 'branch'" class="flex pt-2">
        <div v-for="d in row.depth" :key="d" class="flex w-6 shrink-0 justify-center">
          <div class="w-px bg-line" />
        </div>
        <span
          :class="
            cn(
              'rounded-md px-2 py-0.5 font-mono text-xs font-bold',
              BR_TONE(row.parentType).bg,
              BR_TONE(row.parentType).fg,
            )
          "
          >{{ row.label }}</span
        >
      </div>

      <div
        v-else
        class="flex"
        @dragover="onOver($event, row.key)"
        @dragleave="over === row.key && (over = null)"
        @drop="onDrop($event, row.branchId, row.index)"
      >
        <div v-for="d in row.depth" :key="d" class="flex w-6 shrink-0 justify-center">
          <div class="w-px bg-line" />
        </div>
        <button
          type="button"
          :class="
            cn(
              'mb-1.5 mt-1 flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed text-sm font-semibold transition-colors',
              over === row.key || isPick(row.branchId, row.index)
                ? 'border-primary bg-primary-tint text-primary-strong'
                : 'border-line text-faint hover:border-primary-ring hover:text-primary-strong',
            )
          "
          @click="openPicker($event, row.branchId, row.index)"
        >
          <Plus :size="13" />{{
            dragging
              ? t('logic.builder.dropHere')
              : mode === 'method'
                ? t('logic.builder.addLayer')
                : t('logic.builder.addCall')
          }}
        </button>
      </div>
    </div>

    <PPopover v-model:open="pickOpen" side="right" align="center" :width="380" class="p-0">
      <template #anchor>
        <div
          class="pointer-events-none absolute size-px"
          :style="{ top: `${pick?.top ?? 0}px`, left: `${pick?.left ?? 0}px` }"
        />
      </template>
      <StepPicker
        v-if="pick"
        :mode="mode"
        :functions="functions"
        :allow-return="allowReturn"
        @pick="onPick"
        @close="pick = null"
      />
    </PPopover>
  </div>
</template>
