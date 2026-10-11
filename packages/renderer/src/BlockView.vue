<script setup lang="ts">
/**
 * Renders one block of any BlockType. Props-driven (no Studio stores) so the canvas, Preview and
 * the generated-app runtime share it. Custom components render through the `custom` slot; the
 * blocks inside a container's cells come from the `cell` slot.
 */
import { computed, type Component } from 'vue'
import type { Block } from '@platon/definition'
import type { RenderContext } from './context'
import { blockStyle } from './style'
import HeaderBlock from './blocks/HeaderBlock.vue'
import BasicBlock from './blocks/BasicBlock.vue'
import StatsBlock from './blocks/StatsBlock.vue'
import TableBlock from './blocks/TableBlock.vue'
import RecordBlock from './blocks/RecordBlock.vue'
import ControlBlock from './blocks/ControlBlock.vue'
import ChartBlock from './blocks/ChartBlock.vue'
import WidgetBlock from './blocks/WidgetBlock.vue'
import ContainerBlock from './blocks/ContainerBlock.vue'
import MetricBlock from './blocks/MetricBlock.vue'
import type { CellSlotProps } from './blocks/props'

const props = defineProps<{ block: Block; ctx: RenderContext }>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
defineSlots<{
  custom?: (p: { block: Block }) => unknown
  cell?: (p: CellSlotProps & { block: Block }) => unknown
}>()

const VIEWS: Partial<Record<Block['type'], Component>> = {
  header: HeaderBlock,
  text: BasicBlock,
  image: BasicBlock,
  button: BasicBlock,
  divider: BasicBlock,
  badge: BasicBlock,
  spacer: BasicBlock,
  breadcrumb: BasicBlock,
  empty: BasicBlock,
  container: ContainerBlock,
  section: ContainerBlock,
  grid: ContainerBlock,
  columns: ContainerBlock,
  tabs: ContainerBlock,
  accordion: ContainerBlock,
  stats: StatsBlock,
  table: TableBlock,
  form: RecordBlock,
  list: RecordBlock,
  detail: RecordBlock,
  input: ControlBlock,
  select: ControlBlock,
  checkbox: ControlBlock,
  radio: ControlBlock,
  switch: ControlBlock,
  date: ControlBlock,
  textarea: ControlBlock,
  upload: ControlBlock,
  segmented: ControlBlock,
  richtext: ControlBlock,
  bar: ChartBlock,
  line: ChartBlock,
  donut: ChartBlock,
  area: ChartBlock,
  pie: ChartBlock,
  hbar: ChartBlock,
  stacked: ChartBlock,
  funnel: ChartBlock,
  scatter: ChartBlock,
  gauge: MetricBlock,
  kpi: MetricBlock,
  calendar: WidgetBlock,
  progress: WidgetBlock,
  timeline: WidgetBlock,
  steps: WidgetBlock,
  alert: WidgetBlock,
  pagination: WidgetBlock,
}
const view = computed(() => VIEWS[props.block.type])
const style = computed(() => blockStyle(props.block.style))
</script>

<template>
  <div class="min-w-0 text-(--app-fg)" :style="style" :data-block="block.ref">
    <slot v-if="block.type === 'custom'" name="custom" :block="block" />
    <component
      :is="view"
      v-else-if="view"
      :block="block"
      :ctx="ctx"
      @event="(n: string, a?: unknown) => emit('event', n, a)"
    >
      <template #cell="s: CellSlotProps"><slot name="cell" v-bind="s" :block="block" /></template>
    </component>
  </div>
</template>
