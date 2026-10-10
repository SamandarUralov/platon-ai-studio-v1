<script setup lang="ts">
/** One layer in the builder: icon, type, one-line summary, problem badge, last run result, actions. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, ChevronRight, CircleAlert, Copy, GripVertical, X } from 'lucide-vue-next'
import { STEPS, stepSummary, type Step, type TraceStep } from '@platon/definition'
import { cn, toneClasses } from '@platon/ui'
import ToneTile from '../ToneTile.vue'

const props = defineProps<{
  step: Step
  selected: boolean
  problem?: string
  trace?: TraceStep
  collapsed: boolean
  canUp: boolean
  canDown: boolean
  /** Return layers can't be moved by buttons, duplicated or deleted (requirements §3.3). */
  locked: boolean
}>()
const emit = defineEmits<{
  select: []
  remove: []
  duplicate: []
  up: []
  down: []
  toggle: []
  dragstart: [e: DragEvent]
  dragend: []
}>()
const { t } = useI18n()

const meta = computed(() => STEPS[props.step.type])
const summary = computed(() => stepSummary(props.step))
const traceTone = computed(() =>
  props.trace?.status === 'fail' ? 'danger' : props.trace?.status === 'skip' ? 'neutral' : 'ok',
)
</script>

<template>
  <div
    role="button"
    tabindex="0"
    draggable="true"
    :aria-pressed="selected"
    :class="
      cn(
        'group relative flex min-h-[58px] cursor-pointer items-center gap-2.5 rounded-xl border bg-surface py-2 pl-1.5 pr-2 shadow-xs transition-colors',
        selected
          ? 'border-primary shadow-focus'
          : problem
            ? 'border-danger/40 hover:border-danger/60'
            : 'border-line-2 hover:border-primary-ring',
        trace?.status === 'skip' && 'opacity-60',
      )
    "
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <GripVertical :size="14" class="shrink-0 cursor-grab text-faint-2" aria-hidden="true" />
    <ToneTile :icon="meta.icon" :tone="meta.tone" />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span :class="cn('text-2xs font-bold uppercase tracking-wide', toneClasses[meta.tone].fg)">{{
          meta.label
        }}</span>
        <span v-if="step.note" class="truncate text-2xs text-faint">· {{ step.note }}</span>
      </div>
      <div class="truncate font-mono text-[12.5px] leading-5 text-fg" :title="summary">{{ summary }}</div>
      <div v-if="problem" class="mt-0.5 flex items-center gap-1 text-xs text-danger">
        <CircleAlert :size="12" class="shrink-0" /><span class="truncate">{{ problem }}</span>
      </div>
    </div>

    <span
      v-if="trace"
      :class="
        cn(
          'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-2xs font-semibold',
          toneClasses[traceTone].bg,
          toneClasses[traceTone].fg,
        )
      "
      :title="trace.output"
    >
      {{ trace.status === 'skip' ? t('logic.test.skipped') : `${trace.ms} ms` }}
    </span>

    <div
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      :class="selected && 'opacity-100'"
    >
      <template v-if="!locked">
        <button
          type="button"
          class="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg disabled:opacity-30"
          :disabled="!canUp"
          :title="t('logic.step.up')"
          @click.stop="emit('up')"
        >
          <ArrowUp :size="13" />
        </button>
        <button
          type="button"
          class="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg disabled:opacity-30"
          :disabled="!canDown"
          :title="t('logic.step.down')"
          @click.stop="emit('down')"
        >
          <ArrowDown :size="13" />
        </button>
        <button
          type="button"
          class="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg"
          :title="t('logic.step.duplicate')"
          @click.stop="emit('duplicate')"
        >
          <Copy :size="13" />
        </button>
      </template>
    </div>
    <button
      v-if="!locked"
      type="button"
      class="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
      :title="t('logic.step.delete')"
      @click.stop="emit('remove')"
    >
      <X :size="15" />
    </button>
    <button
      v-if="step.branches?.length"
      type="button"
      class="absolute -left-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-faint shadow-xs hover:text-fg"
      :title="collapsed ? t('logic.step.expand') : t('logic.step.collapse')"
      :aria-expanded="!collapsed"
      @click.stop="emit('toggle')"
    >
      <ChevronRight :size="12" class="transition-transform" :class="collapsed ? '' : 'rotate-90'" />
    </button>
  </div>
</template>
